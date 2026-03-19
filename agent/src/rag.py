"""
RAG over course yardage book PDF using LlamaIndex and Chroma.
Supports static yardage_book.pdf and dynamic per-course generated guides.
"""
import os
import re
from pathlib import Path

# Lazily initialized
_rag_query_engine = None
_course_lookups: dict[str, object] = {}


def _get_data_path() -> Path:
    """Path to default yardage book PDF."""
    base = Path(__file__).resolve().parent.parent
    return base / "data" / "yardage_book.pdf"


async def _noop_rag_lookup(query: str) -> str:
    """No-op when RAG is not configured."""
    return ""


def _make_sync_rag_lookup(qe):
    """Create async wrapper around sync query engine."""

    async def lookup(query: str) -> str:
        if not qe:
            return ""
        try:
            result = qe.query(query)
            return str(result).strip() if result else ""
        except Exception:
            return ""

    return lookup


def _slug(name: str) -> str:
    """Create collection-safe slug."""
    s = re.sub(r"[^\w\s-]", "", (name or "").lower())
    return re.sub(r"[-\s]+", "_", s).strip("_") or "general"


def _documents_from_pdf_with_hole_meta(pdf_path: Path, course_name: str):
    """Extract documents from PDF with hole-level metadata when possible."""
    from llama_index.core import Document
    from pypdf import PdfReader

    reader = PdfReader(str(pdf_path))
    documents = []
    current_hole = None
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if not text or not text.strip():
            continue
        # Try to infer hole from "Hole N" or "## Hole N"
        hole_match = re.search(r"(?:hole|#+\s*hole)\s*(\d+)", text[:200], re.I)
        if hole_match:
            current_hole = int(hole_match.group(1))
        meta = {"page": i + 1, "course": course_name}
        if current_hole:
            meta["hole"] = current_hole
        documents.append(Document(text=text.strip(), metadata=meta))
    return documents


def init_rag():
    """
    Initialize RAG index from the default yardage book PDF.
    Returns an async query function.
    """
    global _rag_query_engine

    data_path = _get_data_path()
    if not data_path.exists():
        return _noop_rag_lookup

    try:
        from llama_index.core import Settings, VectorStoreIndex
        from llama_index.embeddings.openai import OpenAIEmbedding
        from llama_index.vector_stores.chroma import ChromaVectorStore
        import chromadb
    except ImportError:
        return _noop_rag_lookup

    if not os.environ.get("OPENAI_API_KEY"):
        return _noop_rag_lookup

    persist_dir = Path(__file__).resolve().parent.parent / "vector_store"
    persist_dir.mkdir(parents=True, exist_ok=True)

    Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
    Settings.chunk_size = 512
    Settings.chunk_overlap = 50

    chroma_client = chromadb.PersistentClient(path=str(persist_dir))
    chroma_collection = chroma_client.get_or_create_collection(
        "yardage_book", metadata={"hnsw:space": "cosine"}
    )
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)

    try:
        documents = _documents_from_pdf_with_hole_meta(data_path, "yardage_book")
        if not documents:
            return _noop_rag_lookup
        index = VectorStoreIndex.from_documents(
            documents, vector_store=vector_store, show_progress=False
        )
        _rag_query_engine = index.as_query_engine(similarity_top_k=3)
    except Exception:
        return _noop_rag_lookup

    return _make_sync_rag_lookup(_rag_query_engine)


def get_rag_lookup():
    """Return the RAG lookup function, initializing if needed."""
    global _rag_query_engine
    if _rag_query_engine is None:
        init_rag()
    return _make_sync_rag_lookup(_rag_query_engine)


async def get_or_create_rag_for_course(course_name: str):
    """
    Get or create RAG lookup for a specific course.
    Generates course guide PDF if needed, indexes with hole-level chunks.
    Returns async lookup(query) -> str.
    """
    if not course_name or not course_name.strip():
        return get_rag_lookup()
    slug = _slug(course_name)
    if slug in _course_lookups:
        return _course_lookups[slug]

    try:
        from course_guide import generate_course_guide
        from llama_index.core import Document, Settings, VectorStoreIndex
        from llama_index.embeddings.openai import OpenAIEmbedding
        from llama_index.vector_stores.chroma import ChromaVectorStore
        import chromadb
    except ImportError:
        return get_rag_lookup()

    if not os.environ.get("OPENAI_API_KEY"):
        return get_rag_lookup()

    pdf_path = await generate_course_guide(course_name)
    persist_dir = Path(__file__).resolve().parent.parent / "vector_store"
    persist_dir.mkdir(parents=True, exist_ok=True)
    Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
    Settings.chunk_size = 512
    Settings.chunk_overlap = 50

    chroma_client = chromadb.PersistentClient(path=str(persist_dir))
    coll_name = f"course_{slug}"[:63]  # Chroma name limit
    chroma_collection = chroma_client.get_or_create_collection(
        coll_name, metadata={"hnsw:space": "cosine"}
    )
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    documents = _documents_from_pdf_with_hole_meta(pdf_path, course_name)
    if not documents:
        return get_rag_lookup()
    index = VectorStoreIndex.from_documents(
        documents, vector_store=vector_store, show_progress=False
    )
    qe = index.as_query_engine(similarity_top_k=3)

    def _lookup(query: str) -> str:
        try:
            result = qe.query(query)
            return str(result).strip() if result else ""
        except Exception:
            return ""

    async def _async_lookup(query: str) -> str:
        return _lookup(query)

    _course_lookups[slug] = _async_lookup
    return _async_lookup

"""
RAG over course yardage book PDF using LlamaIndex and Chroma.
"""
import os
from pathlib import Path

# Lazily initialized
_rag_query_engine = None


def _get_data_path() -> Path:
    """Path to yardage book PDF."""
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


def init_rag():
    """
    Initialize RAG index from the course yardage book PDF.
    Returns an async query function.
    """
    global _rag_query_engine

    data_path = _get_data_path()
    if not data_path.exists():
        return _noop_rag_lookup

    try:
        from llama_index.core import Document, Settings, VectorStoreIndex
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
        from pypdf import PdfReader

        reader = PdfReader(str(data_path))
        documents = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                documents.append(
                    Document(text=text.strip(), metadata={"page": i + 1})
                )

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
        return init_rag()
    return _make_sync_rag_lookup(_rag_query_engine)

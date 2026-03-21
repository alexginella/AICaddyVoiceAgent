"""
Shared paths, slugs, and Chroma indexing for course yardage PDFs.
Used by the Course Guide Service and the voice agent RAG layer.
"""

from __future__ import annotations

import contextlib
import os
import re
from pathlib import Path

from aicaddy.paths import agent_root as _agent_root


def _optional_path_env(var: str) -> Path | None:
    raw = (os.environ.get(var) or "").strip()
    return Path(raw) if raw else None


def courses_data_dir() -> Path:
    p = _optional_path_env("AICADDY_COURSES_DIR")
    if p is None:
        persist = _optional_path_env("AICADDY_PERSIST_ROOT")
        p = (persist / "courses") if persist is not None else _agent_root() / "data" / "courses"
    p.mkdir(parents=True, exist_ok=True)
    return p


def vector_store_dir() -> Path:
    p = _optional_path_env("AICADDY_VECTOR_STORE_DIR")
    if p is None:
        persist = _optional_path_env("AICADDY_PERSIST_ROOT")
        p = (
            (persist / "vector_store")
            if persist is not None
            else _agent_root() / "vector_store"
        )
    p.mkdir(parents=True, exist_ok=True)
    return p


def filesystem_slug(name: str) -> str:
    """Slug for PDF filenames (hyphens). Matches legacy course_guide layout."""
    s = re.sub(r"[^\w\s-]", "", (name or "").lower())
    return re.sub(r"[-\s]+", "-", s).strip("-") or "unknown"


def index_slug(name: str) -> str:
    """Slug for Chroma collection body (underscores)."""
    s = re.sub(r"[^\w\s-]", "", (name or "").lower())
    return re.sub(r"[-\s]+", "_", s).strip("_") or "general"


def chroma_collection_name_for_course(course_name: str) -> str:
    """Chroma collection id, max 63 chars."""
    base = f"course_{index_slug(course_name)}"
    return base[:63]


def chroma_collection_name_for_pdf_stem(pdf_stem: str) -> str:
    """
    Chroma collection id from the on-disk PDF filename stem (no ``.pdf``), e.g.
    ``pasatiempo-golf-club``. Matches ``chroma_collection_name_for_course(name)`` when
    ``pdf_stem == filesystem_slug(name)``.
    """
    stem = (pdf_stem or "").strip().lower()
    body = stem.replace("-", "_").strip("_") or "general"
    base = f"course_{body}"
    return base[:63]


def course_pdf_path(course_name: str) -> Path:
    return courses_data_dir() / f"{filesystem_slug(course_name)}.pdf"


def documents_from_pdf_with_hole_meta(pdf_path: Path, course_name: str):
    """Extract LlamaIndex documents from PDF with hole-level metadata when possible."""
    from llama_index.core import Document
    from pypdf import PdfReader

    reader = PdfReader(str(pdf_path))
    documents = []
    current_hole = None
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if not text or not text.strip():
            continue
        hole_match = re.search(r"(?:hole|#+\s*hole)\s*(\d+)", text[:200], re.I)
        if hole_match:
            current_hole = int(hole_match.group(1))
        meta: dict = {"page": i + 1, "course": course_name}
        if current_hole:
            meta["hole"] = current_hole
        documents.append(Document(text=text.strip(), metadata=meta))
    return documents


def chroma_collection_vector_count_for_collection(collection_name: str) -> int | None:
    """Return embedding row count if collection exists, else None."""
    try:
        import chromadb
    except ImportError:
        return None
    client = chromadb.PersistentClient(path=str(vector_store_dir()))
    try:
        return client.get_collection(collection_name).count()
    except Exception:
        return None


def chroma_collection_vector_count(course_name: str) -> int | None:
    """Count vectors for the collection derived from display ``course_name``."""
    return chroma_collection_vector_count_for_collection(
        chroma_collection_name_for_course(course_name)
    )


def chroma_collection_id_for_rag(
    *,
    display_course_name: str = "",
    guide_pdf_stem: str = "",
) -> str | None:
    """
    Resolve Chroma collection id for voice RAG. Prefer ``guide_pdf_stem`` from
    ``ensure-guide`` (matches PDF on disk); fall back to slugging display name.
    """
    stem = (guide_pdf_stem or "").strip()
    if stem:
        return chroma_collection_name_for_pdf_stem(stem)
    name = (display_course_name or "").strip()
    if name:
        return chroma_collection_name_for_course(name)
    return None


def guide_fully_ready(course_name: str) -> bool:
    """True when PDF exists on disk and Chroma collection has at least one vector."""
    if not (course_name or "").strip():
        return False
    pdf = course_pdf_path(course_name)
    if not pdf.is_file():
        return False
    coll = chroma_collection_name_for_pdf_stem(pdf.stem)
    n = chroma_collection_vector_count_for_collection(coll)
    return n is not None and n > 0


def index_pdf_to_chroma(course_name: str, pdf_path: Path) -> None:
    """
    Rebuild the per-course Chroma collection from the given PDF.
    """
    import chromadb
    from llama_index.core import Settings, VectorStoreIndex
    from llama_index.embeddings.openai import OpenAIEmbedding
    from llama_index.core.storage.storage_context import StorageContext
    from llama_index.vector_stores.chroma import ChromaVectorStore

    if not os.environ.get("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is required to build the vector index")

    persist_dir = vector_store_dir()
    Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
    Settings.chunk_size = 512
    Settings.chunk_overlap = 50

    coll_name = chroma_collection_name_for_pdf_stem(pdf_path.stem)
    client = chromadb.PersistentClient(path=str(persist_dir))
    with contextlib.suppress(Exception):
        client.delete_collection(coll_name)
    chroma_collection = client.create_collection(
        coll_name, metadata={"hnsw:space": "cosine"}
    )
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    # from_documents only uses vector_store if it is on StorageContext; passing
    # vector_store= as kwargs leaves the default in-memory store and writes nothing to Chroma.
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    documents = documents_from_pdf_with_hole_meta(pdf_path, course_name)
    if not documents:
        raise RuntimeError(f"No text extracted from PDF: {pdf_path}")

    VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=False,
    )

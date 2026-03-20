"""
RAG over course yardage book PDF using LlamaIndex and Chroma.
Supports static yardage_book.pdf and per-course guides (indexed by Course Guide Service).
"""

import logging
import os

from aicaddy.guide.common import (
    chroma_collection_name_for_course,
    documents_from_pdf_with_hole_meta,
    index_slug,
    vector_store_dir,
)
from aicaddy.paths import agent_root

logger = logging.getLogger(__name__)

# Lazily initialized
_rag_query_engine = None
_course_lookups: dict[str, object] = {}


def _get_data_path():
    """Path to default yardage book PDF."""
    return agent_root() / "data" / "yardage_book.pdf"


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
            logger.exception("RAG query engine failed")
            return ""

    return lookup


def _course_chroma_vector_count(course_name: str) -> int | None:
    try:
        import chromadb
    except ImportError:
        return None
    client = chromadb.PersistentClient(path=str(vector_store_dir()))
    coll_name = chroma_collection_name_for_course(course_name)
    try:
        return client.get_collection(coll_name).count()
    except Exception:
        return None


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
        import chromadb
        from llama_index.core import Settings, VectorStoreIndex
        from llama_index.embeddings.openai import OpenAIEmbedding
        from llama_index.vector_stores.chroma import ChromaVectorStore
    except ImportError:
        return _noop_rag_lookup

    if not os.environ.get("OPENAI_API_KEY"):
        return _noop_rag_lookup

    persist_dir = vector_store_dir()
    Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
    Settings.chunk_size = 512
    Settings.chunk_overlap = 50

    chroma_client = chromadb.PersistentClient(path=str(persist_dir))
    chroma_collection = chroma_client.get_or_create_collection(
        "yardage_book", metadata={"hnsw:space": "cosine"}
    )
    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)

    try:
        documents = documents_from_pdf_with_hole_meta(data_path, "yardage_book")
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


async def get_rag_for_course(course_name: str):
    """
    Load RAG lookup for a course from an existing Chroma index only.
    Does not generate PDFs or build indexes (Course Guide Service must run first).
    """
    if not course_name or not course_name.strip():
        return _noop_rag_lookup

    slug = index_slug(course_name)
    if slug in _course_lookups:
        return _course_lookups[slug]

    try:
        import chromadb
        from llama_index.core import Settings, VectorStoreIndex
        from llama_index.embeddings.openai import OpenAIEmbedding
        from llama_index.vector_stores.chroma import ChromaVectorStore
    except ImportError:
        return _noop_rag_lookup

    if not os.environ.get("OPENAI_API_KEY"):
        return _noop_rag_lookup

    n = _course_chroma_vector_count(course_name)
    if n is None or n == 0:
        return _noop_rag_lookup

    persist_dir = vector_store_dir()
    Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small")
    Settings.chunk_size = 512
    Settings.chunk_overlap = 50

    chroma_client = chromadb.PersistentClient(path=str(persist_dir))
    coll_name = chroma_collection_name_for_course(course_name)
    try:
        chroma_collection = chroma_client.get_collection(coll_name)
    except Exception:
        return _noop_rag_lookup

    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    try:
        index = VectorStoreIndex.from_vector_store(vector_store)
    except Exception:
        return _noop_rag_lookup

    qe = index.as_query_engine(similarity_top_k=3)

    def _lookup(query: str) -> str:
        try:
            result = qe.query(query)
            return str(result).strip() if result else ""
        except Exception:
            logger.exception("RAG query failed (per-course index)")
            return ""

    async def _async_lookup(query: str) -> str:
        return _lookup(query)

    _course_lookups[slug] = _async_lookup
    return _async_lookup

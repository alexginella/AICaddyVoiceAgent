"""Errors for Golf Course API client and guide generation."""


class GolfCourseAPIError(Exception):
    """Base: Golf Course API blocked guide generation (no silent fallback)."""


class GolfCourseAPIConfigError(GolfCourseAPIError):
    """Missing configuration (e.g. API key)."""


class GolfCourseAPIAuthError(GolfCourseAPIError):
    """HTTP 401/403: invalid or unauthorized API key."""


class GolfCourseAPIHTTPError(GolfCourseAPIError):
    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class GolfCourseAPINoDataError(GolfCourseAPIError):
    """Search returned nothing, schema mismatch, or no usable hole list."""

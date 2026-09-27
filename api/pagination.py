from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class PagePagination(PageNumberPagination):
    """Page-number pagination that returns the next page number (easy for infinite scroll)."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50

    def get_paginated_response(self, data):
        page = self.page
        return Response({
            "count": page.paginator.count,
            "next_page": page.next_page_number() if page.has_next() else None,
            "results": data,
        })

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "count": {"type": "integer"},
                "next_page": {"type": "integer", "nullable": True},
                "results": schema,
            },
        }

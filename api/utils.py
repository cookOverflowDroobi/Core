def int_param(request, name, default, maximum):
    """Read a positive integer query parameter, clamped to `maximum`, falling back to `default`."""
    try:
        value = int(request.query_params.get(name, default))
    except (TypeError, ValueError):
        return default
    return max(1, min(value, maximum))

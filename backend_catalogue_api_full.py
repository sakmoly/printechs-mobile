@frappe.whitelist(methods=["GET"])
def get_catalogues_list(
    item_group: Optional[str] = None,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    enabled: Optional[int] = 1,
) -> Dict[str, Any]:
    """
    List catalogues for mobile listing screen.

    Query params:
      item_group (optional) - filter by Item Group / Category
      brand      (optional) - filter by Brand
      search     (optional) - substring search on title
      enabled    (optional) - 1/0 or None to ignore

    Response:
    {
      "message": {
        "catalogues": [
          {
            "id": "...",
            "title": "...",
            "item_group": "...",
            "brand": "...",
            "thumbnail_url": "...",
            "description": "...",
            "flip_available": true/false,
            "video_count": 0,
            "youtube_video_url": "..."
          }
        ],
        "total": 1
      }
    }
    """
    filters: Dict[str, Any] = {}
    if enabled is not None:
        filters["enabled"] = int(enabled)
    if item_group:
        filters["item_group"] = item_group
    if brand:
        filters["brand"] = brand

    rows = frappe.get_all(
        "E Catalogue",
        filters=filters,
        fields=[
            "name",
            "title",
            "item_group",
            "brand",
            "thumbnail_image",
            "description",
            "flip_package",
            "flip_entry_file",
            "sort_order",
            "youtube_video_url",
        ],
        order_by="sort_order asc, title asc",
    )

    base_url = get_url()
    result: List[Dict[str, Any]] = []

    for r in rows:
        # Basic search on title (client-style)
        if search and search.lower() not in (r.title or "").lower():
            continue

        thumb_url = f"{base_url}{r.thumbnail_image}" if r.thumbnail_image else None

        video_count = frappe.db.count(
            "E Catalogue Video",
            {
                "parent": r.name,
                "parenttype": "E Catalogue",
                "parentfield": "videos",
                "enabled": 1,
            },
        )

        flip_available = bool(r.flip_package)

        result.append(
            {
                "id": r.name,
                "title": r.title or r.name,
                "item_group": r.item_group,
                "brand": r.brand,
                "thumbnail_url": thumb_url,
                "description": r.description or "",
                "flip_available": flip_available,
                "video_count": video_count,
                "youtube_video_url": r.youtube_video_url or None,
            }
        )

    return {"message": {"catalogues": result, "total": len(result)}}


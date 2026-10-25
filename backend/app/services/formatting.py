def format_money(value: float) -> str:
    """Format an amount as a human-readable ruble string."""
    return f"{value:,.0f}".replace(",", " ") + " ₽"

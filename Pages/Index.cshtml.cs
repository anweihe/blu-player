using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BluesoundWeb.Pages;

public class IndexModel : PageModel
{
    public void OnGet()
    {
        // Homepage - no server-side data needed
        // All logic is handled client-side via JavaScript
    }

    /// <summary>
    /// Returns only the page content for SPA navigation
    /// </summary>
    public IActionResult OnGetFragment()
    {
        return Partial("_IndexContent", this);
    }
}

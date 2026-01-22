using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace BluesoundWeb.Pages;

public class SettingsModel : PageModel
{
    public void OnGet()
    {
    }

    // SPA fragment support
    public IActionResult OnGetFragment()
    {
        return Partial("_SettingsContent");
    }
}

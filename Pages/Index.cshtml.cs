using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Services;

namespace BluesoundWeb.Pages;

public class IndexModel : PageModel
{
    private readonly IListeningHistoryService _historyService;

    public IndexModel(IListeningHistoryService historyService)
    {
        _historyService = historyService;
    }

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

    /// <summary>
    /// Get all listening history for the homepage
    /// </summary>
    public async Task<IActionResult> OnGetHistoryAsync()
    {
        var history = await _historyService.GetAllHistoryAsync();

        return new JsonResult(new
        {
            success = true,
            tuneIn = history.TuneIn,
            radioParadise = history.RadioParadise,
            qobuzAlbums = history.QobuzAlbums,
            qobuzPlaylists = history.QobuzPlaylists
        });
    }
}

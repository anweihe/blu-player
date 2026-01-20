using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Pages;

public class QobuzModel : PageModel
{
    private readonly IQobuzApiService _qobuzService;
    private readonly ILogger<QobuzModel> _logger;

    public QobuzModel(IQobuzApiService qobuzService, ILogger<QobuzModel> logger)
    {
        _qobuzService = qobuzService;
        _logger = logger;
    }

    // Bound properties for the form
    [BindProperty]
    public string? Email { get; set; }

    [BindProperty]
    public string? Password { get; set; }

    // Display properties
    public QobuzUser? QobuzUser { get; set; }
    public List<QobuzPlaylist> Playlists { get; set; } = new();
    public string? ErrorMessage { get; set; }
    public string? SuccessMessage { get; set; }
    public bool IsLoggedIn { get; set; }
    public bool IsInitializing { get; set; }

    public async Task OnGetAsync()
    {
        // Check if we need to initialize app credentials
        if (!_qobuzService.HasAppCredentials)
        {
            IsInitializing = true;
            var credentials = await _qobuzService.ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                ErrorMessage = "Konnte Qobuz App-Credentials nicht laden. Bitte versuche es später erneut.";
            }
            IsInitializing = false;
        }
    }

    public async Task<IActionResult> OnPostLoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "Bitte E-Mail und Passwort eingeben.";
            return Page();
        }

        _logger.LogInformation("Attempting login for {Email}", Email);

        var loginResponse = await _qobuzService.LoginAsync(Email, Password);

        if (loginResponse?.User == null || string.IsNullOrEmpty(loginResponse.UserAuthToken))
        {
            ErrorMessage = "Login fehlgeschlagen. Bitte überprüfe deine Zugangsdaten.";
            return Page();
        }

        QobuzUser = loginResponse.User;
        IsLoggedIn = true;
        SuccessMessage = $"Erfolgreich eingeloggt als {QobuzUser.DisplayName ?? QobuzUser.Email}";

        // Return login data as JSON for JavaScript to store in localStorage
        return new JsonResult(new
        {
            success = true,
            userId = QobuzUser.Id,
            authToken = loginResponse.UserAuthToken,
            displayName = QobuzUser.DisplayName ?? QobuzUser.Email,
            avatar = QobuzUser.Avatar
        });
    }

    public async Task<IActionResult> OnGetVerifyTokenAsync(long userId, string authToken)
    {
        _logger.LogInformation("Verifying token for user {UserId}", userId);

        var loginResponse = await _qobuzService.LoginWithTokenAsync(userId, authToken);

        if (loginResponse?.User == null)
        {
            return new JsonResult(new { success = false, error = "Token ungültig oder abgelaufen" });
        }

        return new JsonResult(new
        {
            success = true,
            userId = loginResponse.User.Id,
            authToken = loginResponse.UserAuthToken,
            displayName = loginResponse.User.DisplayName ?? loginResponse.User.Email,
            avatar = loginResponse.User.Avatar,
            subscription = loginResponse.User.Credential?.Label
        });
    }

    public async Task<IActionResult> OnGetPlaylistsAsync(long userId, string authToken)
    {
        _logger.LogInformation("Fetching playlists for user {UserId}", userId);

        var playlists = await _qobuzService.GetUserPlaylistsAsync(userId, authToken);

        return new JsonResult(new
        {
            success = true,
            playlists = playlists.Select(p => new
            {
                id = p.Id,
                name = p.Name,
                description = p.Description,
                tracksCount = p.TracksCount,
                duration = p.Duration,
                formattedDuration = p.FormattedDuration,
                coverUrl = p.CoverUrl,
                isPublic = p.IsPublic,
                ownerName = p.Owner?.Name
            })
        });
    }
}

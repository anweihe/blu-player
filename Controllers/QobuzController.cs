using Microsoft.AspNetCore.Mvc;
using BluesoundWeb.Services;
using BluesoundWeb.Models;

namespace BluesoundWeb.Controllers;

/// <summary>
/// REST API Controller for Qobuz authentication.
/// Used by the Angular frontend.
/// </summary>
[ApiController]
[Route("api/qobuz")]
public class QobuzController : ControllerBase
{
    private readonly IQobuzApiService _qobuzService;
    private readonly ILogger<QobuzController> _logger;

    public QobuzController(
        IQobuzApiService qobuzService,
        ILogger<QobuzController> logger)
    {
        _qobuzService = qobuzService;
        _logger = logger;
    }

    /// <summary>
    /// Login with email and password
    /// </summary>
    [HttpPost("login")]
    public async Task<ActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { success = false, message = "E-Mail und Passwort erforderlich" });
        }

        _logger.LogInformation("API Login attempt for {Email}", request.Email);

        // Ensure app credentials are loaded
        if (!_qobuzService.HasAppCredentials)
        {
            var credentials = await _qobuzService.ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                return StatusCode(503, new { success = false, message = "Qobuz-Dienst nicht verfügbar" });
            }
        }

        var loginResponse = await _qobuzService.LoginAsync(request.Email, request.Password);

        if (loginResponse?.User == null || string.IsNullOrEmpty(loginResponse.UserAuthToken))
        {
            return Unauthorized(new { success = false, message = "Login fehlgeschlagen" });
        }

        return Ok(new
        {
            user_auth_token = loginResponse.UserAuthToken,
            user = new
            {
                id = loginResponse.User.Id,
                login = loginResponse.User.Login,
                email = loginResponse.User.Email,
                display_name = loginResponse.User.DisplayName,
                avatar = loginResponse.User.Avatar,
                credential = loginResponse.User.Credential != null ? new
                {
                    label = loginResponse.User.Credential.Label,
                    description = loginResponse.User.Credential.Description
                } : null
            }
        });
    }

    /// <summary>
    /// Verify existing token
    /// </summary>
    [HttpGet("user")]
    public async Task<ActionResult> GetUser(
        [FromHeader(Name = "X-Auth-Token")] string? authToken,
        [FromHeader(Name = "X-User-Id")] string? userIdStr)
    {
        if (string.IsNullOrEmpty(authToken) || string.IsNullOrEmpty(userIdStr) || !long.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { success = false, message = "Auth-Token erforderlich" });
        }

        _logger.LogInformation("API Token verification for user {UserId}", userId);

        // Ensure app credentials are loaded
        if (!_qobuzService.HasAppCredentials)
        {
            var credentials = await _qobuzService.ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                return StatusCode(503, new { success = false, message = "Qobuz-Dienst nicht verfügbar" });
            }
        }

        var loginResponse = await _qobuzService.LoginWithTokenAsync(userId, authToken);

        if (loginResponse?.User == null)
        {
            return Unauthorized(new { success = false, message = "Token ungültig" });
        }

        return Ok(new
        {
            id = loginResponse.User.Id,
            login = loginResponse.User.Login,
            email = loginResponse.User.Email,
            display_name = loginResponse.User.DisplayName,
            avatar = loginResponse.User.Avatar,
            credential = loginResponse.User.Credential != null ? new
            {
                label = loginResponse.User.Credential.Label,
                description = loginResponse.User.Credential.Description
            } : null
        });
    }
}

// ==================== Request DTOs ====================

public record LoginRequest(string Email, string Password);

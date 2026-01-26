using Microsoft.AspNetCore.Mvc;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Controllers;

/// <summary>
/// API controller for user settings and profiles
/// Replaces the Razor Pages API at /Api/Settings
/// </summary>
[ApiController]
[Route("Api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;

    public SettingsController(ISettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    // GET /Api/Settings?handler=profiles
    [HttpGet]
    public async Task<IActionResult> GetProfiles([FromQuery] string? handler)
    {
        return handler?.ToLower() switch
        {
            "profiles" => await GetAllProfiles(),
            "profile" => await GetProfile(Request.Query["id"].ToString()),
            "mistralapikey" => await GetMistralApiKeyStatus(),
            _ => await GetAllProfiles() // Default to profiles list
        };
    }

    private async Task<IActionResult> GetAllProfiles()
    {
        var profiles = await _settingsService.GetAllProfilesAsync();
        return Ok(ApiResponse<List<ProfileDto>>.Ok(profiles));
    }

    private async Task<IActionResult> GetProfile(string id)
    {
        var profile = await _settingsService.GetProfileByIdAsync(id);
        if (profile == null)
        {
            return Ok(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return Ok(ApiResponse<ProfileDto>.Ok(profile));
    }

    private async Task<IActionResult> GetMistralApiKeyStatus()
    {
        var hasKey = await _settingsService.HasMistralApiKeyAsync();
        return Ok(ApiResponse<ApiKeyStatusDto>.Ok(new ApiKeyStatusDto
        {
            IsConfigured = hasKey
        }));
    }

    // POST /Api/Settings?handler=profile
    [HttpPost]
    public async Task<IActionResult> Post([FromQuery] string? handler, [FromBody] object body)
    {
        return handler?.ToLower() switch
        {
            "profile" => await CreateProfile(body),
            "migrate" => await Migrate(body),
            _ => BadRequest("Unknown handler")
        };
    }

    private async Task<IActionResult> CreateProfile(object body)
    {
        var request = System.Text.Json.JsonSerializer.Deserialize<CreateProfileRequest>(
            System.Text.Json.JsonSerializer.Serialize(body));
        if (request == null) return BadRequest("Invalid request");

        var profile = await _settingsService.CreateProfileAsync(request.Name);
        return Ok(ApiResponse<ProfileDto>.Ok(profile));
    }

    private async Task<IActionResult> Migrate(object body)
    {
        try
        {
            var request = System.Text.Json.JsonSerializer.Deserialize<MigrateRequest>(
                System.Text.Json.JsonSerializer.Serialize(body));
            if (request == null) return BadRequest("Invalid request");

            var success = await _settingsService.MigrateFromLocalStorageAsync(request);
            return Ok(new { success, migrated = success });
        }
        catch (Exception ex)
        {
            return Ok(ApiResponse.Fail(ex.Message));
        }
    }

    // PUT /Api/Settings?handler=xxx&id=xxx
    [HttpPut]
    public async Task<IActionResult> Put([FromQuery] string? handler, [FromQuery] string? id, [FromBody] object body)
    {
        if (string.IsNullOrEmpty(id) && handler?.ToLower() != "mistralapikey")
        {
            return BadRequest("Profile ID required");
        }

        return handler?.ToLower() switch
        {
            "profile" => await UpdateProfile(id!, body),
            "qobuz" => await UpdateQobuzCredentials(id!, body),
            "quality" => await UpdateQuality(id!, body),
            "player" => await UpdatePlayer(id!, body),
            "mistralapikey" => await SetMistralApiKey(body),
            _ => BadRequest("Unknown handler")
        };
    }

    private async Task<IActionResult> UpdateProfile(string id, object body)
    {
        var request = System.Text.Json.JsonSerializer.Deserialize<UpdateProfileRequest>(
            System.Text.Json.JsonSerializer.Serialize(body));
        if (request == null) return BadRequest("Invalid request");

        var profile = await _settingsService.UpdateProfileAsync(id, request.Name ?? "");
        if (profile == null)
        {
            return Ok(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return Ok(ApiResponse<ProfileDto>.Ok(profile));
    }

    private async Task<IActionResult> UpdateQobuzCredentials(string id, object body)
    {
        var request = System.Text.Json.JsonSerializer.Deserialize<UpdateQobuzCredentialsRequest>(
            System.Text.Json.JsonSerializer.Serialize(body));
        if (request == null) return BadRequest("Invalid request");

        var profile = await _settingsService.UpdateQobuzCredentialsAsync(id, request);
        if (profile == null)
        {
            return Ok(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return Ok(ApiResponse<ProfileDto>.Ok(profile));
    }

    private async Task<IActionResult> UpdateQuality(string id, object body)
    {
        var request = System.Text.Json.JsonSerializer.Deserialize<UpdateQualityRequest>(
            System.Text.Json.JsonSerializer.Serialize(body));
        if (request == null) return BadRequest("Invalid request");

        var profile = await _settingsService.UpdateStreamingQualityAsync(id, request.FormatId);
        if (profile == null)
        {
            return Ok(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return Ok(ApiResponse<ProfileDto>.Ok(profile));
    }

    private async Task<IActionResult> UpdatePlayer(string id, object body)
    {
        var request = System.Text.Json.JsonSerializer.Deserialize<UpdatePlayerRequest>(
            System.Text.Json.JsonSerializer.Serialize(body));
        if (request == null) return BadRequest("Invalid request");

        var profile = await _settingsService.UpdatePlayerSelectionAsync(id, request);
        if (profile == null)
        {
            return Ok(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return Ok(ApiResponse<ProfileDto>.Ok(profile));
    }

    private async Task<IActionResult> SetMistralApiKey(object body)
    {
        var request = System.Text.Json.JsonSerializer.Deserialize<SetApiKeyRequest>(
            System.Text.Json.JsonSerializer.Serialize(body));
        if (request == null || string.IsNullOrWhiteSpace(request.ApiKey))
        {
            return Ok(ApiResponse.Fail("API Key darf nicht leer sein"));
        }

        var success = await _settingsService.SetMistralApiKeyAsync(request.ApiKey);
        if (!success)
        {
            return Ok(ApiResponse.Fail("Fehler beim Speichern des API Keys"));
        }
        return Ok(ApiResponse.Ok());
    }

    // DELETE /Api/Settings?handler=xxx&id=xxx
    [HttpDelete]
    public async Task<IActionResult> Delete([FromQuery] string? handler, [FromQuery] string? id)
    {
        return handler?.ToLower() switch
        {
            "profile" => await DeleteProfile(id!),
            "qobuz" => await DeleteQobuzCredentials(id!),
            "mistralapikey" => await DeleteMistralApiKey(),
            _ => BadRequest("Unknown handler")
        };
    }

    private async Task<IActionResult> DeleteProfile(string id)
    {
        var success = await _settingsService.DeleteProfileAsync(id);
        if (!success)
        {
            return Ok(ApiResponse.Fail("Profile not found"));
        }
        return Ok(ApiResponse.Ok());
    }

    private async Task<IActionResult> DeleteQobuzCredentials(string id)
    {
        var success = await _settingsService.DeleteQobuzCredentialsAsync(id);
        if (!success)
        {
            return Ok(ApiResponse.Fail("Profile not found"));
        }
        return Ok(ApiResponse.Ok());
    }

    private async Task<IActionResult> DeleteMistralApiKey()
    {
        var success = await _settingsService.DeleteMistralApiKeyAsync();
        return Ok(success ? ApiResponse.Ok() : ApiResponse.Fail("Fehler beim Löschen"));
    }
}

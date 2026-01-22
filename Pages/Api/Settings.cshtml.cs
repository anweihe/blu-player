using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using BluesoundWeb.Models;
using BluesoundWeb.Services;

namespace BluesoundWeb.Pages.Api;

[IgnoreAntiforgeryToken]
public class SettingsModel : PageModel
{
    private readonly ISettingsService _settingsService;

    public SettingsModel(ISettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    // GET /api/settings?handler=profiles
    public async Task<IActionResult> OnGetProfilesAsync()
    {
        var profiles = await _settingsService.GetAllProfilesAsync();
        return new JsonResult(ApiResponse<List<ProfileDto>>.Ok(profiles));
    }

    // GET /api/settings?handler=profile&id=xxx
    public async Task<IActionResult> OnGetProfileAsync(string id)
    {
        var profile = await _settingsService.GetProfileByIdAsync(id);
        if (profile == null)
        {
            return new JsonResult(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return new JsonResult(ApiResponse<ProfileDto>.Ok(profile));
    }

    // POST /api/settings?handler=profile
    public async Task<IActionResult> OnPostProfileAsync([FromBody] CreateProfileRequest request)
    {
        var profile = await _settingsService.CreateProfileAsync(request.Name);
        return new JsonResult(ApiResponse<ProfileDto>.Ok(profile));
    }

    // PUT /api/settings?handler=profile&id=xxx
    public async Task<IActionResult> OnPutProfileAsync(string id, [FromBody] UpdateProfileRequest request)
    {
        var profile = await _settingsService.UpdateProfileAsync(id, request.Name ?? "");
        if (profile == null)
        {
            return new JsonResult(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return new JsonResult(ApiResponse<ProfileDto>.Ok(profile));
    }

    // DELETE /api/settings?handler=profile&id=xxx
    public async Task<IActionResult> OnDeleteProfileAsync(string id)
    {
        var success = await _settingsService.DeleteProfileAsync(id);
        if (!success)
        {
            return new JsonResult(ApiResponse.Fail("Profile not found"));
        }
        return new JsonResult(ApiResponse.Ok());
    }

    // GET /api/settings?handler=activeProfile
    public async Task<IActionResult> OnGetActiveProfileAsync()
    {
        var profileId = await _settingsService.GetActiveProfileIdAsync();
        return new JsonResult(ApiResponse<string?>.Ok(profileId));
    }

    // PUT /api/settings?handler=activeProfile
    public async Task<IActionResult> OnPutActiveProfileAsync([FromBody] SetActiveProfileRequest request)
    {
        var success = await _settingsService.SetActiveProfileIdAsync(request.ProfileId);
        if (!success)
        {
            return new JsonResult(ApiResponse.Fail("Profile not found"));
        }
        return new JsonResult(ApiResponse.Ok());
    }

    // PUT /api/settings?handler=qobuz&id=xxx
    public async Task<IActionResult> OnPutQobuzAsync(string id, [FromBody] UpdateQobuzCredentialsRequest request)
    {
        var profile = await _settingsService.UpdateQobuzCredentialsAsync(id, request);
        if (profile == null)
        {
            return new JsonResult(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return new JsonResult(ApiResponse<ProfileDto>.Ok(profile));
    }

    // DELETE /api/settings?handler=qobuz&id=xxx
    public async Task<IActionResult> OnDeleteQobuzAsync(string id)
    {
        var success = await _settingsService.DeleteQobuzCredentialsAsync(id);
        if (!success)
        {
            return new JsonResult(ApiResponse.Fail("Profile not found"));
        }
        return new JsonResult(ApiResponse.Ok());
    }

    // PUT /api/settings?handler=quality&id=xxx
    public async Task<IActionResult> OnPutQualityAsync(string id, [FromBody] UpdateQualityRequest request)
    {
        var profile = await _settingsService.UpdateStreamingQualityAsync(id, request.FormatId);
        if (profile == null)
        {
            return new JsonResult(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return new JsonResult(ApiResponse<ProfileDto>.Ok(profile));
    }

    // PUT /api/settings?handler=player&id=xxx
    public async Task<IActionResult> OnPutPlayerAsync(string id, [FromBody] UpdatePlayerRequest request)
    {
        var profile = await _settingsService.UpdatePlayerSelectionAsync(id, request);
        if (profile == null)
        {
            return new JsonResult(ApiResponse<ProfileDto>.Fail("Profile not found"));
        }
        return new JsonResult(ApiResponse<ProfileDto>.Ok(profile));
    }

    // POST /api/settings?handler=migrate
    public async Task<IActionResult> OnPostMigrateAsync([FromBody] MigrateRequest request)
    {
        try
        {
            var success = await _settingsService.MigrateFromLocalStorageAsync(request);
            return new JsonResult(new { success, migrated = success });
        }
        catch (Exception ex)
        {
            return new JsonResult(ApiResponse.Fail(ex.Message));
        }
    }

    // ==================== API Keys ====================

    // GET /api/settings?handler=mistralApiKey
    public async Task<IActionResult> OnGetMistralApiKeyAsync()
    {
        var hasKey = await _settingsService.HasMistralApiKeyAsync();
        return new JsonResult(ApiResponse<ApiKeyStatusDto>.Ok(new ApiKeyStatusDto
        {
            IsConfigured = hasKey
        }));
    }

    // PUT /api/settings?handler=mistralApiKey
    public async Task<IActionResult> OnPutMistralApiKeyAsync([FromBody] SetApiKeyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ApiKey))
        {
            return new JsonResult(ApiResponse.Fail("API Key darf nicht leer sein"));
        }

        var success = await _settingsService.SetMistralApiKeyAsync(request.ApiKey);
        if (!success)
        {
            return new JsonResult(ApiResponse.Fail("Fehler beim Speichern des API Keys"));
        }
        return new JsonResult(ApiResponse.Ok());
    }

    // DELETE /api/settings?handler=mistralApiKey
    public async Task<IActionResult> OnDeleteMistralApiKeyAsync()
    {
        var success = await _settingsService.DeleteMistralApiKeyAsync();
        return new JsonResult(success ? ApiResponse.Ok() : ApiResponse.Fail("Fehler beim Löschen"));
    }
}

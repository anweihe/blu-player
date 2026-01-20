using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using BluesoundWeb.Models;

namespace BluesoundWeb.Services;

/// <summary>
/// Service interface for Qobuz API communication
/// </summary>
public interface IQobuzApiService
{
    /// <summary>
    /// Extract app credentials from Qobuz web player bundle
    /// </summary>
    Task<QobuzAppCredentials?> ExtractAppCredentialsAsync();

    /// <summary>
    /// Login with email/username and password
    /// </summary>
    Task<QobuzLoginResponse?> LoginAsync(string emailOrUsername, string password);

    /// <summary>
    /// Login with existing token (session restoration)
    /// </summary>
    Task<QobuzLoginResponse?> LoginWithTokenAsync(long userId, string authToken);

    /// <summary>
    /// Get user's playlists
    /// </summary>
    Task<List<QobuzPlaylist>> GetUserPlaylistsAsync(long userId, string authToken);

    /// <summary>
    /// Check if app credentials are available
    /// </summary>
    bool HasAppCredentials { get; }
}

/// <summary>
/// Service for communicating with Qobuz API
/// </summary>
public class QobuzApiService : IQobuzApiService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<QobuzApiService> _logger;

    private const string QobuzApiBase = "https://www.qobuz.com/api.json/0.2";
    private const string QobuzPlayUrl = "https://play.qobuz.com";

    // Cached app credentials
    private static QobuzAppCredentials? _cachedCredentials;
    private static readonly SemaphoreSlim _credentialLock = new(1, 1);

    public bool HasAppCredentials => _cachedCredentials != null;

    public QobuzApiService(HttpClient httpClient, ILogger<QobuzApiService> logger)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        _logger = logger;
    }

    /// <summary>
    /// Extract app_id and app_secret from Qobuz web player bundle.js
    /// </summary>
    public async Task<QobuzAppCredentials?> ExtractAppCredentialsAsync()
    {
        await _credentialLock.WaitAsync();
        try
        {
            // Return cached credentials if available
            if (_cachedCredentials != null)
            {
                return _cachedCredentials;
            }

            _logger.LogInformation("Extracting Qobuz app credentials from web player...");

            // Step 1: Fetch the main page to find bundle.js URL
            var mainPageHtml = await _httpClient.GetStringAsync(QobuzPlayUrl);

            // Find bundle.js URL - look for script tags with bundle in the src
            var bundleUrlMatch = Regex.Match(mainPageHtml, @"<script[^>]+src=""([^""]*bundle[^""]*\.js)""", RegexOptions.IgnoreCase);
            if (!bundleUrlMatch.Success)
            {
                // Try alternative pattern
                bundleUrlMatch = Regex.Match(mainPageHtml, @"""(/resources/\d+\.\d+\.\d+-[^""]+/bundle\.js)""");
            }

            string bundleUrl;
            if (bundleUrlMatch.Success)
            {
                bundleUrl = bundleUrlMatch.Groups[1].Value;
                if (!bundleUrl.StartsWith("http"))
                {
                    bundleUrl = QobuzPlayUrl + bundleUrl;
                }
            }
            else
            {
                // Fallback: try common bundle path patterns
                _logger.LogWarning("Could not find bundle URL in HTML, trying fallback patterns...");
                bundleUrl = $"{QobuzPlayUrl}/resources/bundle.js";
            }

            _logger.LogDebug("Fetching bundle from: {BundleUrl}", bundleUrl);

            // Step 2: Fetch the bundle.js
            var bundleJs = await _httpClient.GetStringAsync(bundleUrl);

            // Step 3: Extract app_id
            var appId = ExtractAppId(bundleJs);
            if (string.IsNullOrEmpty(appId))
            {
                _logger.LogError("Failed to extract app_id from bundle");
                return null;
            }

            // Step 4: Extract app_secret (more complex)
            var appSecret = ExtractAppSecret(bundleJs);
            if (string.IsNullOrEmpty(appSecret))
            {
                _logger.LogError("Failed to extract app_secret from bundle");
                return null;
            }

            _cachedCredentials = new QobuzAppCredentials
            {
                AppId = appId,
                AppSecret = appSecret
            };

            _logger.LogInformation("Successfully extracted Qobuz app credentials. App ID: {AppId}", appId);
            return _cachedCredentials;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to extract Qobuz app credentials");
            return null;
        }
        finally
        {
            _credentialLock.Release();
        }
    }

    private string? ExtractAppId(string bundleJs)
    {
        // Various patterns used by Qobuz for app_id
        var patterns = new[]
        {
            @"production:\{api:\{appId:""([^""]+)""",
            @"production:\{[^}]*api:\{[^}]*appId:""([^""]+)""",
            @"""app_id""\s*:\s*""(\d+)""",
            @"app_id\s*[=:]\s*[""'](\d+)[""']",
            @"appId\s*[=:]\s*[""'](\d+)[""']",
            @"[""'](\d{9})[""']" // App IDs are typically 9 digits
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(bundleJs, pattern);
            if (match.Success)
            {
                var appId = match.Groups[1].Value;
                _logger.LogDebug("Found app_id with pattern {Pattern}: {AppId}", pattern, appId);
                return appId;
            }
        }

        return null;
    }

    private string? ExtractAppSecret(string bundleJs)
    {
        // The app_secret extraction is complex in QobuzApiSharp
        // It involves:
        // 1. Finding a seed value (base64 encoded)
        // 2. Finding timezone info
        // 3. Combining them and decoding

        // Simplified approach: Look for common secret patterns
        var patterns = new[]
        {
            // Direct secret patterns (32-40 char hex strings near relevant keywords)
            @"secret[""'\s:=]+([a-f0-9]{32,40})",
            @"app_secret[""'\s:=]+([a-f0-9]{32,40})",
            @"appSecret[""'\s:=]+([a-f0-9]{32,40})",
            // Base64 encoded secrets
            @"""([A-Za-z0-9+/]{40,}={0,2})""",
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(bundleJs, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                var secret = match.Groups[1].Value;
                // Validate it looks like a secret (alphanumeric, reasonable length)
                if (secret.Length >= 32 && secret.Length <= 64)
                {
                    _logger.LogDebug("Found potential app_secret with pattern {Pattern}", pattern);
                    return secret;
                }
            }
        }

        // Advanced extraction based on QobuzApiSharp method
        return ExtractAppSecretAdvanced(bundleJs);
    }

    private string? ExtractAppSecretAdvanced(string bundleJs)
    {
        try
        {
            // Look for the seed and info pattern used by QobuzApiSharp
            // Pattern: seed:"BASE64",extras:{info:"STRING",extras:"STRING"}

            // Find seed
            var seedMatch = Regex.Match(bundleJs, @"seed\s*:\s*""([A-Za-z0-9+/=]+)""");
            if (!seedMatch.Success)
            {
                _logger.LogDebug("Could not find seed in bundle");
                return null;
            }

            var seed = seedMatch.Groups[1].Value;

            // Find info strings
            var infoMatch = Regex.Match(bundleJs, @"info\s*:\s*""([^""]+)""");
            var extrasMatch = Regex.Match(bundleJs, @"extras\s*:\s*""([^""]+)""");

            if (!infoMatch.Success)
            {
                _logger.LogDebug("Could not find info in bundle");
                return null;
            }

            var info = infoMatch.Groups[1].Value;
            var extras = extrasMatch.Success ? extrasMatch.Groups[1].Value : "";

            // Combine and decode
            var combined = seed + info + extras;

            // Remove last 44 characters as per QobuzApiSharp
            if (combined.Length > 44)
            {
                combined = combined.Substring(0, combined.Length - 44);
            }

            // Try to base64 decode
            try
            {
                var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(combined));
                if (!string.IsNullOrEmpty(decoded) && decoded.Length >= 20)
                {
                    return decoded;
                }
            }
            catch
            {
                // Not valid base64, return as-is if it looks valid
                if (combined.Length >= 32 && Regex.IsMatch(combined, @"^[a-zA-Z0-9]+$"))
                {
                    return combined;
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Advanced secret extraction failed");
            return null;
        }
    }

    /// <summary>
    /// Login with email/username and password
    /// </summary>
    public async Task<QobuzLoginResponse?> LoginAsync(string emailOrUsername, string password)
    {
        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot login: app credentials not available");
                return null;
            }

            // MD5 hash the password
            var passwordHash = ComputeMd5Hash(password);

            // Determine if it's email or username
            var isEmail = emailOrUsername.Contains('@');
            var paramName = isEmail ? "email" : "username";

            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>(paramName, emailOrUsername),
                new KeyValuePair<string, string>("password", passwordHash),
                new KeyValuePair<string, string>("app_id", credentials.AppId)
            });

            _logger.LogInformation("Attempting Qobuz login for {User}", emailOrUsername);

            var response = await _httpClient.PostAsync($"{QobuzApiBase}/user/login", content);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Qobuz login failed with status {Status}: {Response}",
                    response.StatusCode, responseContent);
                return null;
            }

            var loginResponse = JsonSerializer.Deserialize<QobuzLoginResponse>(responseContent);
            if (loginResponse?.User != null)
            {
                _logger.LogInformation("Qobuz login successful for user {UserId}", loginResponse.User.Id);
            }

            return loginResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Qobuz login failed");
            return null;
        }
    }

    /// <summary>
    /// Login with existing token for session restoration
    /// </summary>
    public async Task<QobuzLoginResponse?> LoginWithTokenAsync(long userId, string authToken)
    {
        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot login with token: app credentials not available");
                return null;
            }

            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("user_id", userId.ToString()),
                new KeyValuePair<string, string>("user_auth_token", authToken),
                new KeyValuePair<string, string>("app_id", credentials.AppId)
            });

            _logger.LogInformation("Attempting Qobuz token login for user {UserId}", userId);

            var response = await _httpClient.PostAsync($"{QobuzApiBase}/user/login", content);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Qobuz token login failed with status {Status}", response.StatusCode);
                return null;
            }

            var loginResponse = JsonSerializer.Deserialize<QobuzLoginResponse>(responseContent);
            if (loginResponse?.User != null)
            {
                _logger.LogInformation("Qobuz token login successful");
            }

            return loginResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Qobuz token login failed");
            return null;
        }
    }

    /// <summary>
    /// Get user's playlists
    /// </summary>
    public async Task<List<QobuzPlaylist>> GetUserPlaylistsAsync(long userId, string authToken)
    {
        var allPlaylists = new List<QobuzPlaylist>();

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get playlists: app credentials not available");
                return allPlaylists;
            }

            int offset = 0;
            const int limit = 50;
            bool hasMore = true;

            while (hasMore)
            {
                var url = $"{QobuzApiBase}/playlist/getUserPlaylists" +
                          $"?user_id={userId}" +
                          $"&app_id={credentials.AppId}" +
                          $"&user_auth_token={authToken}" +
                          $"&limit={limit}" +
                          $"&offset={offset}";

                _logger.LogDebug("Fetching playlists from offset {Offset}", offset);

                var response = await _httpClient.GetAsync(url);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Failed to get playlists: {Status}", response.StatusCode);
                    break;
                }

                var playlistsResponse = JsonSerializer.Deserialize<QobuzPlaylistsResponse>(responseContent);
                var items = playlistsResponse?.Playlists?.Items;

                if (items != null && items.Count > 0)
                {
                    allPlaylists.AddRange(items);
                    offset += items.Count;
                    hasMore = offset < (playlistsResponse?.Playlists?.Total ?? 0);
                }
                else
                {
                    hasMore = false;
                }
            }

            _logger.LogInformation("Retrieved {Count} playlists for user {UserId}", allPlaylists.Count, userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get user playlists");
        }

        return allPlaylists;
    }

    private static string ComputeMd5Hash(string input)
    {
        using var md5 = MD5.Create();
        var inputBytes = Encoding.UTF8.GetBytes(input);
        var hashBytes = md5.ComputeHash(inputBytes);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using BluesoundWeb.Models;
using Microsoft.Extensions.Configuration;

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
    /// Get playlist with tracks
    /// </summary>
    Task<QobuzPlaylistWithTracks?> GetPlaylistAsync(long playlistId, string authToken);

    /// <summary>
    /// Get track streaming URL
    /// </summary>
    Task<string?> GetTrackStreamUrlAsync(long trackId, string authToken, int formatId = 27);

    /// <summary>
    /// Get featured/new release albums
    /// </summary>
    Task<List<QobuzAlbum>> GetFeaturedAlbumsAsync(string type = "new-releases", int limit = 50);

    /// <summary>
    /// Get featured/editorial playlists from Qobuz
    /// </summary>
    Task<List<QobuzPlaylist>> GetFeaturedPlaylistsAsync(int limit = 50);

    /// <summary>
    /// Get album with tracks
    /// </summary>
    Task<QobuzAlbumWithTracks?> GetAlbumAsync(string albumId, string authToken);

    /// <summary>
    /// Check if app credentials are available
    /// </summary>
    bool HasAppCredentials { get; }

    /// <summary>
    /// Clear cached credentials to force re-extraction
    /// </summary>
    void ClearCachedCredentials();
}

/// <summary>
/// Service for communicating with Qobuz API
/// </summary>
public class QobuzApiService : IQobuzApiService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<QobuzApiService> _logger;
    private readonly IConfiguration _configuration;

    private const string QobuzApiBase = "https://www.qobuz.com/api.json/0.2";
    private const string QobuzPlayUrl = "https://play.qobuz.com";

    // Cached app credentials
    private static QobuzAppCredentials? _cachedCredentials;
    private static readonly SemaphoreSlim _credentialLock = new(1, 1);

    public bool HasAppCredentials => _cachedCredentials != null;

    /// <summary>
    /// Clear cached credentials to force re-extraction
    /// </summary>
    public void ClearCachedCredentials()
    {
        _cachedCredentials = null;
    }

    public QobuzApiService(HttpClient httpClient, ILogger<QobuzApiService> logger, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        _logger = logger;
        _configuration = configuration;
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

            // Check for manual configuration first (fallback)
            var manualAppId = _configuration["Qobuz:AppId"];
            var manualAppSecret = _configuration["Qobuz:AppSecret"];

            if (!string.IsNullOrEmpty(manualAppId) && !string.IsNullOrEmpty(manualAppSecret))
            {
                _logger.LogInformation("Using manually configured Qobuz credentials");
                _cachedCredentials = new QobuzAppCredentials
                {
                    AppId = manualAppId,
                    AppSecret = manualAppSecret
                };
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
                AppSecret = appSecret,
                AlternativeSecrets = _extractedSecrets.Where(s => s != appSecret).ToList()
            };

            _logger.LogInformation("Successfully extracted Qobuz app credentials. App ID: {AppId}, Secret length: {SecretLength}, Alternatives: {AltCount}",
                appId, appSecret.Length, _cachedCredentials.AlternativeSecrets.Count);
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

    private List<string> _extractedSecrets = new();

    private string? ExtractAppSecret(string bundleJs)
    {
        _logger.LogDebug("Starting app_secret extraction from bundle ({Length} chars)", bundleJs.Length);
        _extractedSecrets.Clear();

        // Method based on qobuz-dl: seed + timezone + info/extras
        var qobuzDlSecret = ExtractAppSecretQobuzDl(bundleJs);
        if (!string.IsNullOrEmpty(qobuzDlSecret))
        {
            _logger.LogInformation("Extracted {Count} secrets using qobuz-dl method", _extractedSecrets.Count);
            return qobuzDlSecret;
        }

        _logger.LogWarning("App_secret extraction failed");
        return null;
    }

    private string? ExtractAppSecretQobuzDl(string bundleJs)
    {
        try
        {
            // Step 1: Find all seeds with their timezone identifiers
            // Pattern: initialSeed("base64seed", window.utimezone.timezone)
            var seedPattern = @"[a-z]\.initialSeed\(""(?<seed>[\w=]+)"",window\.utimezone\.(?<timezone>[a-z]+)\)";
            var seedMatches = Regex.Matches(bundleJs, seedPattern);

            if (seedMatches.Count == 0)
            {
                _logger.LogDebug("No seed patterns found with double quotes, trying single quotes");
                seedPattern = @"[a-z]\.initialSeed\('(?<seed>[\w=]+)',window\.utimezone\.(?<timezone>[a-z]+)\)";
                seedMatches = Regex.Matches(bundleJs, seedPattern);
            }

            if (seedMatches.Count == 0)
            {
                _logger.LogDebug("No seed patterns found");
                return null;
            }

            // Build ordered list of (timezone, seed) pairs - order matters!
            var seedList = new List<(string timezone, string seed, int position)>();
            foreach (Match match in seedMatches)
            {
                var tz = match.Groups["timezone"].Value;
                var seed = match.Groups["seed"].Value;
                seedList.Add((tz, seed, match.Index));
                _logger.LogInformation("Found seed for timezone {Timezone} at position {Pos}: {Seed}...",
                    tz, match.Index, seed.Substring(0, Math.Min(20, seed.Length)));
            }

            // Sort by position and reorder: move second item to first (qobuz-dl does this)
            seedList = seedList.OrderBy(x => x.position).ToList();
            if (seedList.Count >= 2)
            {
                var first = seedList[0];
                var second = seedList[1];
                seedList[0] = second;
                seedList[1] = first;
                _logger.LogDebug("Reordered timezones: {Order}", string.Join(", ", seedList.Select(x => x.timezone)));
            }

            var seeds = seedList.ToDictionary(x => x.timezone, x => x.seed);

            // Step 2: Build timezone pattern for info/extras lookup
            // Capitalize first letter of each timezone
            var timezones = string.Join("|", seedList.Select(x =>
                char.ToUpper(x.timezone[0]) + x.timezone.Substring(1)));

            _logger.LogDebug("Looking for info/extras with timezone pattern: {Timezones}", timezones);

            // Pattern: name:"Something/Timezone",info:"base64",extras:"base64"
            var infoPattern = $@"name:""\w+/(?<timezone>{timezones})"",info:""(?<info>[\w=]+)"",extras:""(?<extras>[\w=]+)""";
            var infoMatches = Regex.Matches(bundleJs, infoPattern);

            if (infoMatches.Count == 0)
            {
                _logger.LogDebug("No info/extras patterns found with double quotes, trying single quotes");
                infoPattern = $@"name:'\w+/(?<timezone>{timezones})',info:'(?<info>[\w=]+)',extras:'(?<extras>[\w=]+)'";
                infoMatches = Regex.Matches(bundleJs, infoPattern);
            }

            if (infoMatches.Count == 0)
            {
                _logger.LogDebug("No info/extras patterns found");
                return null;
            }

            _logger.LogInformation("Found {Count} info/extras matches", infoMatches.Count);

            // Step 3: Combine seed + info + extras for each timezone and decode
            // Try them in the reordered sequence
            foreach (var seedItem in seedList)
            {
                var tzLower = seedItem.timezone;
                var tzCapitalized = char.ToUpper(tzLower[0]) + tzLower.Substring(1);

                // Find matching info/extras
                foreach (Match infoMatch in infoMatches)
                {
                    var matchedTz = infoMatch.Groups["timezone"].Value;
                    if (!matchedTz.Equals(tzCapitalized, StringComparison.OrdinalIgnoreCase))
                        continue;

                    var info = infoMatch.Groups["info"].Value;
                    var extras = infoMatch.Groups["extras"].Value;
                    var seed = seedItem.seed;

                    _logger.LogInformation("Combining for {Timezone}: seed({SeedLen}) + info({InfoLen}) + extras({ExtrasLen})",
                        tzLower, seed.Length, info.Length, extras.Length);

                    // Combine: seed + info + extras
                    var combined = seed + info + extras;
                    _logger.LogDebug("Combined string length: {Length}", combined.Length);

                    // Remove last 44 characters and decode
                    if (combined.Length > 44)
                    {
                        var toDecode = combined.Substring(0, combined.Length - 44);
                        _logger.LogDebug("String to decode (length {Length}): {Preview}...",
                            toDecode.Length, toDecode.Substring(0, Math.Min(30, toDecode.Length)));

                        try
                        {
                            // Pad base64 if needed
                            while (toDecode.Length % 4 != 0)
                            {
                                toDecode += "=";
                            }

                            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(toDecode));

                            _logger.LogInformation("Decoded secret for {Timezone}: length={Length}, preview={Preview}...",
                                tzLower, decoded.Length, decoded.Substring(0, Math.Min(10, decoded.Length)));

                            if (!string.IsNullOrEmpty(decoded) && decoded.Length >= 20)
                            {
                                // Store all decoded secrets
                                if (!_extractedSecrets.Contains(decoded))
                                {
                                    _extractedSecrets.Add(decoded);
                                }

                                // Check if it looks like a real secret (should have letters, not just hex)
                                var hasLetters = decoded.Any(c => char.IsLetter(c) && !IsHexChar(c));
                                _logger.LogInformation("Secret has non-hex letters: {HasLetters}", hasLetters);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to decode combined string for timezone {Timezone}", tzLower);
                        }
                    }
                }
            }

            // Return the first extracted secret (if any)
            if (_extractedSecrets.Count > 0)
            {
                _logger.LogInformation("Extracted {Count} total secrets from all timezones", _extractedSecrets.Count);
                return _extractedSecrets[0];
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "qobuz-dl extraction method failed");
            return null;
        }
    }

    private static bool IsHexChar(char c)
    {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
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

    /// <summary>
    /// Get playlist with all tracks
    /// </summary>
    public async Task<QobuzPlaylistWithTracks?> GetPlaylistAsync(long playlistId, string authToken)
    {
        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get playlist: app credentials not available");
                return null;
            }

            var url = $"{QobuzApiBase}/playlist/get" +
                      $"?playlist_id={playlistId}" +
                      $"&extra=tracks" +
                      $"&limit=500" +
                      $"&app_id={credentials.AppId}" +
                      $"&user_auth_token={authToken}";

            _logger.LogDebug("Fetching playlist {PlaylistId}", playlistId);

            var response = await _httpClient.GetAsync(url);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get playlist: {Status}", response.StatusCode);
                return null;
            }

            var playlist = JsonSerializer.Deserialize<QobuzPlaylistWithTracks>(responseContent);
            _logger.LogInformation("Retrieved playlist {PlaylistId} with {TrackCount} tracks",
                playlistId, playlist?.Tracks?.Items?.Count ?? 0);

            return playlist;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get playlist {PlaylistId}", playlistId);
            return null;
        }
    }

    /// <summary>
    /// Get streaming URL for a track - tries all available secrets
    /// </summary>
    public async Task<string?> GetTrackStreamUrlAsync(long trackId, string authToken, int formatId = 27)
    {
        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get stream URL: app credentials not available");
                return null;
            }

            // Try all available secrets
            var secretsToTry = new List<string>();

            // Add main secret
            if (!string.IsNullOrEmpty(credentials.AppSecret))
            {
                secretsToTry.Add(credentials.AppSecret);
            }

            // Add alternative secrets if available
            if (credentials.AlternativeSecrets != null)
            {
                secretsToTry.AddRange(credentials.AlternativeSecrets);
            }

            if (secretsToTry.Count == 0)
            {
                _logger.LogError("No secrets available - signature will fail");
                return null;
            }

            // Timestamp must be a float with decimals (like Python's time.time())
            var timestamp = (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0).ToString("F3", System.Globalization.CultureInfo.InvariantCulture);

            foreach (var secret in secretsToTry)
            {
                // Generate request signature
                // Format: trackgetFileUrl + sorted params (format_id, intent, track_id) + timestamp + secret
                // Params must be sorted alphabetically: format_id, intent, track_id
                var signatureInput = $"trackgetFileUrlformat_id{formatId}intentstreamtrack_id{trackId}{timestamp}{secret}";
                var requestSig = ComputeMd5Hash(signatureInput);

                _logger.LogDebug("Trying secret (preview: {Preview}...)", secret.Substring(0, Math.Min(8, secret.Length)));

                var url = $"{QobuzApiBase}/track/getFileUrl" +
                          $"?track_id={trackId}" +
                          $"&format_id={formatId}" +
                          $"&intent=stream" +
                          $"&request_ts={timestamp}" +
                          $"&request_sig={requestSig}" +
                          $"&app_id={credentials.AppId}" +
                          $"&user_auth_token={authToken}";

                var response = await _httpClient.GetAsync(url);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(responseContent);
                    if (doc.RootElement.TryGetProperty("url", out var urlElement))
                    {
                        _logger.LogInformation("Successfully got stream URL with secret (preview: {Preview}...)",
                            secret.Substring(0, Math.Min(8, secret.Length)));
                        return urlElement.GetString();
                    }
                }
                else
                {
                    _logger.LogDebug("Secret failed: {Status}", response.StatusCode);
                }
            }

            _logger.LogWarning("All {Count} secrets failed for track {TrackId}", secretsToTry.Count, trackId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get stream URL for track {TrackId}", trackId);
            return null;
        }
    }

    /// <summary>
    /// Get featured/new release albums from Qobuz
    /// </summary>
    public async Task<List<QobuzAlbum>> GetFeaturedAlbumsAsync(string type = "new-releases", int limit = 50)
    {
        var albums = new List<QobuzAlbum>();

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get featured albums: app credentials not available");
                return albums;
            }

            // type can be: new-releases, most-streamed, best-sellers, press-awards, editor-picks, most-featured
            var url = $"{QobuzApiBase}/album/getFeatured" +
                      $"?type={type}" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}";

            _logger.LogDebug("Fetching featured albums: {Type}", type);

            var response = await _httpClient.GetAsync(url);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get featured albums: {Status}", response.StatusCode);
                return albums;
            }

            var albumsResponse = JsonSerializer.Deserialize<QobuzFeaturedAlbumsResponse>(responseContent);
            if (albumsResponse?.Albums?.Items != null)
            {
                albums.AddRange(albumsResponse.Albums.Items);
            }

            _logger.LogInformation("Retrieved {Count} featured albums ({Type})", albums.Count, type);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get featured albums");
        }

        return albums;
    }

    /// <summary>
    /// Get featured/editorial playlists from Qobuz
    /// </summary>
    public async Task<List<QobuzPlaylist>> GetFeaturedPlaylistsAsync(int limit = 50)
    {
        var playlists = new List<QobuzPlaylist>();

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get featured playlists: app credentials not available");
                return playlists;
            }

            var url = $"{QobuzApiBase}/playlist/getFeatured" +
                      $"?type=editor-picks" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}";

            _logger.LogDebug("Fetching featured playlists");

            var response = await _httpClient.GetAsync(url);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get featured playlists: {Status}", response.StatusCode);
                return playlists;
            }

            var playlistsResponse = JsonSerializer.Deserialize<QobuzFeaturedPlaylistsResponse>(responseContent);
            if (playlistsResponse?.Playlists?.Items != null)
            {
                playlists.AddRange(playlistsResponse.Playlists.Items);
            }

            _logger.LogInformation("Retrieved {Count} featured playlists", playlists.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get featured playlists");
        }

        return playlists;
    }

    /// <summary>
    /// Get album with all tracks
    /// </summary>
    public async Task<QobuzAlbumWithTracks?> GetAlbumAsync(string albumId, string authToken)
    {
        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get album: app credentials not available");
                return null;
            }

            var url = $"{QobuzApiBase}/album/get" +
                      $"?album_id={albumId}" +
                      $"&app_id={credentials.AppId}" +
                      $"&user_auth_token={authToken}";

            _logger.LogDebug("Fetching album {AlbumId}", albumId);

            var response = await _httpClient.GetAsync(url);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get album: {Status}", response.StatusCode);
                return null;
            }

            var album = JsonSerializer.Deserialize<QobuzAlbumWithTracks>(responseContent);
            _logger.LogInformation("Retrieved album {AlbumId} with {TrackCount} tracks",
                albumId, album?.Tracks?.Items?.Count ?? 0);

            return album;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get album {AlbumId}", albumId);
            return null;
        }
    }

    private static string ComputeMd5Hash(string input)
    {
        using var md5 = MD5.Create();
        var inputBytes = Encoding.UTF8.GetBytes(input);
        var hashBytes = md5.ComputeHash(inputBytes);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}

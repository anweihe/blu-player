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
    /// Get featured/new release albums (old endpoint, no pagination)
    /// </summary>
    Task<List<QobuzAlbum>> GetFeaturedAlbumsAsync(string type = "new-releases", int limit = 50);

    /// <summary>
    /// Get new releases from discover endpoint with pagination
    /// </summary>
    Task<(List<QobuzAlbum> Albums, bool HasMore)> GetNewReleasesAsync(string? authToken = null, int offset = 0, int limit = 50);

    /// <summary>
    /// Get most streamed albums from discover endpoint with pagination
    /// </summary>
    Task<(List<QobuzAlbum> Albums, bool HasMore)> GetMostStreamedAlbumsAsync(string? authToken = null, int offset = 0, int limit = 50);

    /// <summary>
    /// Get featured/editorial playlists from Qobuz (old endpoint, no pagination)
    /// </summary>
    Task<List<QobuzPlaylist>> GetFeaturedPlaylistsAsync(int limit = 50);

    /// <summary>
    /// Get discover playlists with pagination and optional tag/genre filters
    /// </summary>
    Task<(List<QobuzPlaylist> Playlists, bool HasMore)> GetDiscoverPlaylistsAsync(string? authToken = null, int offset = 0, int limit = 50, string? tags = null, string? genreIds = null);

    /// <summary>
    /// Get album with tracks
    /// </summary>
    Task<QobuzAlbumWithTracks?> GetAlbumAsync(string albumId, string authToken);

    /// <summary>
    /// Search for albums, tracks, and playlists
    /// </summary>
    Task<QobuzSearchResult> SearchAsync(string query, int limit = 20);

    /// <summary>
    /// Get personalized recommendations for the user
    /// </summary>
    Task<QobuzRecommendationsResult> GetRecommendationsAsync(string authToken, int limit = 50);

    /// <summary>
    /// Get user's favorite albums
    /// </summary>
    Task<List<QobuzAlbum>> GetFavoriteAlbumsAsync(string authToken, int limit = 500);

    /// <summary>
    /// Get user's favorite tracks
    /// </summary>
    Task<List<QobuzTrack>> GetFavoriteTracksAsync(string authToken, int limit = 500);

    /// <summary>
    /// Get user's favorite artists
    /// </summary>
    Task<List<QobuzFavoriteArtist>> GetFavoriteArtistsAsync(string authToken, int limit = 100);

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
    /// Get new releases from discover/newReleases endpoint with pagination
    /// </summary>
    public async Task<(List<QobuzAlbum> Albums, bool HasMore)> GetNewReleasesAsync(string? authToken = null, int offset = 0, int limit = 50)
    {
        var albums = new List<QobuzAlbum>();
        var hasMore = false;

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get new releases: app credentials not available");
                return (albums, hasMore);
            }

            var url = $"{QobuzApiBase}/discover/newReleases" +
                      $"?genre_ids=" +
                      $"&offset={offset}" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}" +
                      (string.IsNullOrEmpty(authToken) ? "" : $"&user_auth_token={authToken}");

            _logger.LogDebug("Fetching new releases from offset {Offset}", offset);

            var response = await _httpClient.GetAsync(url);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get new releases: {Status}", response.StatusCode);
                return (albums, hasMore);
            }

            // Parse the JSON: { has_more: bool, items: [...] }
            using var doc = JsonDocument.Parse(responseContent);
            var root = doc.RootElement;

            hasMore = root.TryGetProperty("has_more", out var hasMoreElement) && hasMoreElement.GetBoolean();

            if (root.TryGetProperty("items", out var items))
            {
                foreach (var item in items.EnumerateArray())
                {
                    try
                    {
                        var album = new QobuzAlbum
                        {
                            Id = item.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
                            Title = item.TryGetProperty("title", out var title) ? title.GetString() ?? "" : ""
                        };

                        // Get artist info - API returns "artists" array
                        if (item.TryGetProperty("artists", out var artists))
                        {
                            foreach (var artistItem in artists.EnumerateArray())
                            {
                                var isMainArtist = artistItem.TryGetProperty("roles", out var roles) &&
                                    roles.EnumerateArray().Any(r => r.GetString() == "main-artist");

                                if (isMainArtist || album.Artist == null)
                                {
                                    album.Artist = new QobuzArtist
                                    {
                                        Id = artistItem.TryGetProperty("id", out var artistId) ? artistId.GetInt64() : 0,
                                        Name = artistItem.TryGetProperty("name", out var artistName) ? artistName.GetString() ?? "" : ""
                                    };

                                    if (isMainArtist) break;
                                }
                            }
                        }
                        else if (item.TryGetProperty("artist", out var artist))
                        {
                            album.Artist = new QobuzArtist
                            {
                                Id = artist.TryGetProperty("id", out var artistId) ? artistId.GetInt64() : 0,
                                Name = artist.TryGetProperty("name", out var artistName) ? artistName.GetString() ?? "" : ""
                            };
                        }

                        // Get cover image
                        if (item.TryGetProperty("image", out var image))
                        {
                            album.Image = new QobuzImage
                            {
                                Small = image.TryGetProperty("small", out var small) ? small.GetString() : null,
                                Thumbnail = image.TryGetProperty("thumbnail", out var thumb) ? thumb.GetString() : null,
                                Large = image.TryGetProperty("large", out var large) ? large.GetString() : null
                            };
                        }

                        albums.Add(album);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to parse album item");
                    }
                }
            }

            _logger.LogInformation("Retrieved {Count} new releases (offset: {Offset}, hasMore: {HasMore})",
                albums.Count, offset, hasMore);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get new releases");
        }

        return (albums, hasMore);
    }

    /// <summary>
    /// Get most streamed albums from discover/mostStreamed endpoint with pagination
    /// </summary>
    public async Task<(List<QobuzAlbum> Albums, bool HasMore)> GetMostStreamedAlbumsAsync(string? authToken = null, int offset = 0, int limit = 50)
    {
        var albums = new List<QobuzAlbum>();
        var hasMore = false;

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get most streamed albums: app credentials not available");
                return (albums, hasMore);
            }

            var url = $"{QobuzApiBase}/discover/mostStreamed" +
                      $"?genre_ids=" +
                      $"&offset={offset}" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}" +
                      (string.IsNullOrEmpty(authToken) ? "" : $"&user_auth_token={authToken}");

            _logger.LogDebug("Fetching most streamed albums from offset {Offset}", offset);

            var response = await _httpClient.GetAsync(url);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get most streamed albums: {Status}", response.StatusCode);
                return (albums, hasMore);
            }

            // Parse the JSON: { has_more: bool, items: [...] }
            using var doc = JsonDocument.Parse(responseContent);
            var root = doc.RootElement;

            hasMore = root.TryGetProperty("has_more", out var hasMoreElement) && hasMoreElement.GetBoolean();

            if (root.TryGetProperty("items", out var items))
            {
                foreach (var item in items.EnumerateArray())
                {
                    try
                    {
                        var album = new QobuzAlbum
                        {
                            Id = item.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
                            Title = item.TryGetProperty("title", out var title) ? title.GetString() ?? "" : ""
                        };

                        // Get artist info - API returns "artists" array, find main-artist
                        if (item.TryGetProperty("artists", out var artists))
                        {
                            foreach (var artistItem in artists.EnumerateArray())
                            {
                                // Check for main-artist role or just use first artist
                                var isMainArtist = artistItem.TryGetProperty("roles", out var roles) &&
                                    roles.EnumerateArray().Any(r => r.GetString() == "main-artist");

                                if (isMainArtist || album.Artist == null)
                                {
                                    album.Artist = new QobuzArtist
                                    {
                                        Id = artistItem.TryGetProperty("id", out var artistId) ? artistId.GetInt64() : 0,
                                        Name = artistItem.TryGetProperty("name", out var artistName) ? artistName.GetString() ?? "" : ""
                                    };

                                    if (isMainArtist) break;
                                }
                            }
                        }
                        // Fallback to single artist object if present
                        else if (item.TryGetProperty("artist", out var artist))
                        {
                            album.Artist = new QobuzArtist
                            {
                                Id = artist.TryGetProperty("id", out var artistId) ? artistId.GetInt64() : 0,
                                Name = artist.TryGetProperty("name", out var artistName) ? artistName.GetString() ?? "" : ""
                            };
                        }

                        // Get cover image
                        if (item.TryGetProperty("image", out var image))
                        {
                            album.Image = new QobuzImage
                            {
                                Small = image.TryGetProperty("small", out var small) ? small.GetString() : null,
                                Thumbnail = image.TryGetProperty("thumbnail", out var thumb) ? thumb.GetString() : null,
                                Large = image.TryGetProperty("large", out var large) ? large.GetString() : null
                            };
                        }

                        albums.Add(album);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to parse album item");
                    }
                }
            }

            _logger.LogInformation("Retrieved {Count} most streamed albums (offset: {Offset}, hasMore: {HasMore})",
                albums.Count, offset, hasMore);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get most streamed albums");
        }

        return (albums, hasMore);
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
    /// Get discover playlists with pagination and optional tag/genre filters (uses discover/playlists endpoint)
    /// </summary>
    public async Task<(List<QobuzPlaylist> Playlists, bool HasMore)> GetDiscoverPlaylistsAsync(string? authToken = null, int offset = 0, int limit = 50, string? tags = null, string? genreIds = null)
    {
        var playlists = new List<QobuzPlaylist>();
        var hasMore = false;

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get discover playlists: app credentials not available");
                return (playlists, hasMore);
            }

            var url = $"{QobuzApiBase}/discover/playlists" +
                      $"?genre_ids={genreIds ?? ""}" +
                      $"&tags={tags ?? ""}" +
                      $"&offset={offset}" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}" +
                      (string.IsNullOrEmpty(authToken) ? "" : $"&user_auth_token={authToken}");

            _logger.LogDebug("Fetching discover playlists (offset: {Offset}, limit: {Limit}, tags: {Tags}, genreIds: {GenreIds})", offset, limit, tags ?? "(all)", genreIds ?? "(all)");

            var response = await _httpClient.GetAsync(url);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to get discover playlists: {Status}", response.StatusCode);
                return (playlists, hasMore);
            }

            // Parse JSON response: { has_more: bool, items: [...] }
            using var doc = JsonDocument.Parse(responseContent);
            var root = doc.RootElement;

            // Get has_more flag
            hasMore = root.TryGetProperty("has_more", out var hasMoreElement) && hasMoreElement.GetBoolean();

            // Get items array
            if (root.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in items.EnumerateArray())
                {
                    var playlist = new QobuzPlaylist
                    {
                        Id = item.TryGetProperty("id", out var id) ? id.GetInt64() : 0,
                        Name = item.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "",
                        Description = item.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                        TracksCount = item.TryGetProperty("tracks_count", out var tc) ? tc.GetInt32() : 0,
                        Duration = item.TryGetProperty("duration", out var dur) ? dur.GetInt32() : 0,
                        IsPublic = item.TryGetProperty("is_public", out var isPublic) && isPublic.GetBoolean()
                    };

                    // Get image from nested image object (discover/playlists format)
                    if (item.TryGetProperty("image", out var imageObj) && imageObj.ValueKind == JsonValueKind.Object)
                    {
                        // Get covers array (preferred)
                        if (imageObj.TryGetProperty("covers", out var covers) && covers.ValueKind == JsonValueKind.Array)
                        {
                            var imageUrls = new List<string>();
                            foreach (var img in covers.EnumerateArray())
                            {
                                if (img.ValueKind == JsonValueKind.String)
                                {
                                    imageUrls.Add(img.GetString() ?? "");
                                }
                            }
                            playlist.Images300 = imageUrls;
                        }

                        // Also get rectangle image as fallback
                        if (imageObj.TryGetProperty("rectangle", out var rectangle) && rectangle.ValueKind == JsonValueKind.String)
                        {
                            playlist.ImageRectangle = new List<string> { rectangle.GetString() ?? "" };
                        }
                    }

                    // Get owner info
                    if (item.TryGetProperty("owner", out var owner))
                    {
                        playlist.Owner = new QobuzPlaylistOwner
                        {
                            Id = owner.TryGetProperty("id", out var ownerId) ? ownerId.GetInt64() : 0,
                            Name = owner.TryGetProperty("name", out var ownerName) ? ownerName.GetString() ?? "" : ""
                        };
                    }

                    playlists.Add(playlist);
                }
            }

            _logger.LogInformation("Retrieved {Count} discover playlists (offset: {Offset}, hasMore: {HasMore})",
                playlists.Count, offset, hasMore);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get discover playlists");
        }

        return (playlists, hasMore);
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

    /// <summary>
    /// Search for albums, tracks, and playlists
    /// </summary>
    public async Task<QobuzSearchResult> SearchAsync(string query, int limit = 20)
    {
        var result = new QobuzSearchResult();

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot search: app credentials not available");
                return result;
            }

            var encodedQuery = Uri.EscapeDataString(query);
            var url = $"{QobuzApiBase}/catalog/search" +
                      $"?query={encodedQuery}" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}";

            _logger.LogDebug("Searching for: {Query}", query);

            var response = await _httpClient.GetAsync(url);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Search failed: {Status}", response.StatusCode);
                return result;
            }

            var searchResponse = JsonSerializer.Deserialize<QobuzSearchResponse>(responseContent);

            if (searchResponse?.Albums?.Items != null)
            {
                result.Albums = searchResponse.Albums.Items;
            }

            if (searchResponse?.Playlists?.Items != null)
            {
                result.Playlists = searchResponse.Playlists.Items;
            }

            if (searchResponse?.Tracks?.Items != null)
            {
                result.Tracks = searchResponse.Tracks.Items;
            }

            _logger.LogInformation("Search for '{Query}' returned {Albums} albums, {Playlists} playlists, {Tracks} tracks",
                query, result.Albums.Count, result.Playlists.Count, result.Tracks.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Search failed for query: {Query}", query);
        }

        return result;
    }

    /// <summary>
    /// Get personalized recommendations for the user (uses favorite albums as basis)
    /// </summary>
    public async Task<QobuzRecommendationsResult> GetRecommendationsAsync(string authToken, int limit = 50)
    {
        var result = new QobuzRecommendationsResult();

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get recommendations: app credentials not available");
                return result;
            }

            // Get user's favorite albums as "recommendations"
            var albumsUrl = $"{QobuzApiBase}/favorite/getUserFavorites" +
                      $"?type=albums" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}" +
                      $"&user_auth_token={authToken}";

            _logger.LogDebug("Fetching favorite albums for recommendations");

            var albumsResponse = await _httpClient.GetAsync(albumsUrl);
            if (albumsResponse.IsSuccessStatusCode)
            {
                var albumsContent = await albumsResponse.Content.ReadAsStringAsync();
                var favAlbums = JsonSerializer.Deserialize<QobuzFavoriteAlbumsResponse>(albumsContent);
                if (favAlbums?.Albums?.Items != null)
                {
                    result.Albums = favAlbums.Albums.Items;
                }
            }

            // Get user's favorite tracks
            var tracksUrl = $"{QobuzApiBase}/favorite/getUserFavorites" +
                      $"?type=tracks" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}" +
                      $"&user_auth_token={authToken}";

            _logger.LogDebug("Fetching favorite tracks for recommendations");

            var tracksResponse = await _httpClient.GetAsync(tracksUrl);
            if (tracksResponse.IsSuccessStatusCode)
            {
                var tracksContent = await tracksResponse.Content.ReadAsStringAsync();
                var favTracks = JsonSerializer.Deserialize<QobuzFavoriteTracksResponse>(tracksContent);
                if (favTracks?.Tracks?.Items != null)
                {
                    result.Tracks = favTracks.Tracks.Items;
                }
            }

            _logger.LogInformation("Retrieved favorites: {Albums} albums, {Tracks} tracks",
                result.Albums.Count, result.Tracks.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get recommendations/favorites");
        }

        return result;
    }

    /// <summary>
    /// Get user's favorite albums
    /// </summary>
    public async Task<List<QobuzAlbum>> GetFavoriteAlbumsAsync(string authToken, int limit = 500)
    {
        var albums = new List<QobuzAlbum>();

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get favorite albums: app credentials not available");
                return albums;
            }

            var url = $"{QobuzApiBase}/favorite/getUserFavorites" +
                      $"?type=albums" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}" +
                      $"&user_auth_token={authToken}";

            _logger.LogDebug("Fetching favorite albums (limit: {Limit})", limit);

            var response = await _httpClient.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var favAlbums = JsonSerializer.Deserialize<QobuzFavoriteAlbumsResponse>(content);
                if (favAlbums?.Albums?.Items != null)
                {
                    albums.AddRange(favAlbums.Albums.Items);
                }
            }

            _logger.LogInformation("Retrieved {Count} favorite albums", albums.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get favorite albums");
        }

        return albums;
    }

    /// <summary>
    /// Get user's favorite tracks
    /// </summary>
    public async Task<List<QobuzTrack>> GetFavoriteTracksAsync(string authToken, int limit = 500)
    {
        var tracks = new List<QobuzTrack>();

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get favorite tracks: app credentials not available");
                return tracks;
            }

            var url = $"{QobuzApiBase}/favorite/getUserFavorites" +
                      $"?type=tracks" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}" +
                      $"&user_auth_token={authToken}";

            _logger.LogDebug("Fetching favorite tracks (limit: {Limit})", limit);

            var response = await _httpClient.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var favTracks = JsonSerializer.Deserialize<QobuzFavoriteTracksResponse>(content);
                if (favTracks?.Tracks?.Items != null)
                {
                    tracks.AddRange(favTracks.Tracks.Items);
                }
            }

            _logger.LogInformation("Retrieved {Count} favorite tracks", tracks.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get favorite tracks");
        }

        return tracks;
    }

    /// <summary>
    /// Get user's favorite artists
    /// </summary>
    public async Task<List<QobuzFavoriteArtist>> GetFavoriteArtistsAsync(string authToken, int limit = 100)
    {
        var artists = new List<QobuzFavoriteArtist>();

        try
        {
            var credentials = await ExtractAppCredentialsAsync();
            if (credentials == null)
            {
                _logger.LogError("Cannot get favorite artists: app credentials not available");
                return artists;
            }

            var url = $"{QobuzApiBase}/favorite/getUserFavorites" +
                      $"?type=artists" +
                      $"&limit={limit}" +
                      $"&app_id={credentials.AppId}" +
                      $"&user_auth_token={authToken}";

            _logger.LogDebug("Fetching favorite artists (limit: {Limit})", limit);

            var response = await _httpClient.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var favArtists = JsonSerializer.Deserialize<QobuzFavoriteArtistsResponse>(content);
                if (favArtists?.Artists?.Items != null)
                {
                    artists.AddRange(favArtists.Artists.Items);
                }
            }

            _logger.LogInformation("Retrieved {Count} favorite artists", artists.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get favorite artists");
        }

        return artists;
    }

    private static string ComputeMd5Hash(string input)
    {
        using var md5 = MD5.Create();
        var inputBytes = Encoding.UTF8.GetBytes(input);
        var hashBytes = md5.ComputeHash(inputBytes);
        return Convert.ToHexString(hashBytes).ToLowerInvariant();
    }
}

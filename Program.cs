using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using BluesoundWeb.Data;
using BluesoundWeb.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();

// Register database context - PostgreSQL for production, SQLite for development
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

if (!string.IsNullOrEmpty(connectionString))
{
    // PostgreSQL when connection string is provided (Docker/Coolify)
    builder.Services.AddDbContext<BluesoundDbContext>(options =>
        options.UseNpgsql(connectionString));
}
else
{
    // SQLite for local development
    var dataFolder = Path.Combine(builder.Environment.ContentRootPath, "data");
    Directory.CreateDirectory(dataFolder);
    var dbPath = Path.Combine(dataFolder, "bluesound.db");
    builder.Services.AddDbContext<BluesoundDbContext>(options =>
        options.UseSqlite($"Data Source={dbPath}")
               .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning)));
}

// Register Encryption service
builder.Services.AddSingleton<IEncryptionService, EncryptionService>();

// Register Settings service
builder.Services.AddScoped<ISettingsService, SettingsService>();

// Register Queue service
builder.Services.AddScoped<IQueueService, QueueService>();

// Register StoredPlayer service for database persistence
builder.Services.AddScoped<IStoredPlayerService, StoredPlayerService>();

// Register Bluesound services
builder.Services.AddHttpClient<IBluesoundApiService, BluesoundApiService>();
builder.Services.AddScoped<IPlayerDiscoveryService, PlayerDiscoveryService>();
builder.Services.AddSingleton<IPlayerCacheService, PlayerCacheService>();
builder.Services.AddScoped<IBluesoundPlayerService, BluesoundPlayerService>();

// Register Qobuz service
builder.Services.AddHttpClient<IQobuzApiService, QobuzApiService>();

// Register Album Rating service
builder.Services.AddScoped<IAlbumRatingService, AlbumRatingService>();

var app = builder.Build();

// Apply pending migrations at startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BluesoundDbContext>();
    db.Database.Migrate();
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();
app.MapRazorPages()
   .WithStaticAssets();

app.Run();

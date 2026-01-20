using Microsoft.EntityFrameworkCore;
using BluesoundWeb.Data;
using BluesoundWeb.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();

// Register SQLite database
var dataFolder = Path.Combine(builder.Environment.ContentRootPath, "data");
Directory.CreateDirectory(dataFolder);
var dbPath = Path.Combine(dataFolder, "bluesound.db");
builder.Services.AddDbContext<BluesoundDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// Register Settings service
builder.Services.AddScoped<ISettingsService, SettingsService>();

// Register Queue service
builder.Services.AddScoped<IQueueService, QueueService>();

// Register Bluesound services
builder.Services.AddHttpClient<IBluesoundApiService, BluesoundApiService>();
builder.Services.AddScoped<IPlayerDiscoveryService, PlayerDiscoveryService>();
builder.Services.AddSingleton<IPlayerCacheService, PlayerCacheService>();

// Register Qobuz service
builder.Services.AddHttpClient<IQobuzApiService, QobuzApiService>();

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

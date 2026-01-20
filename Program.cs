using BluesoundWeb.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();

// Register Bluesound services
builder.Services.AddHttpClient<IBluesoundApiService, BluesoundApiService>();
builder.Services.AddScoped<IPlayerDiscoveryService, PlayerDiscoveryService>();

// Register Qobuz service
builder.Services.AddHttpClient<IQobuzApiService, QobuzApiService>();

var app = builder.Build();

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

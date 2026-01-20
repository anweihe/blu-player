using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BluesoundWeb.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<BluesoundDbContext>
{
    public BluesoundDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<BluesoundDbContext>();

        // Use PostgreSQL for migration generation
        // This connection string is only used at design-time for generating migrations
        optionsBuilder.UseNpgsql("Host=localhost;Database=bluesound_design;Username=postgres;Password=postgres");

        return new BluesoundDbContext(optionsBuilder.Options);
    }
}

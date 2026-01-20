using Microsoft.EntityFrameworkCore;
using BluesoundWeb.Models;

namespace BluesoundWeb.Data;

public class BluesoundDbContext : DbContext
{
    public BluesoundDbContext(DbContextOptions<BluesoundDbContext> options) : base(options)
    {
    }

    public DbSet<UserProfile> UserProfiles { get; set; } = null!;
    public DbSet<UserQobuzCredential> QobuzCredentials { get; set; } = null!;
    public DbSet<ProfileSettings> ProfileSettings { get; set; } = null!;
    public DbSet<GlobalSettings> GlobalSettings { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // UserProfile configuration
        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ProfileId).IsUnique();
            entity.Property(e => e.ProfileId).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
        });

        // UserQobuzCredential configuration (1:1 with UserProfile)
        modelBuilder.Entity<UserQobuzCredential>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserProfileId).IsUnique();
            entity.Property(e => e.AuthToken).IsRequired().HasMaxLength(500);
            entity.Property(e => e.DisplayName).HasMaxLength(200);
            entity.Property(e => e.Avatar).HasMaxLength(1000);

            entity.HasOne(e => e.UserProfile)
                  .WithOne(p => p.QobuzCredential)
                  .HasForeignKey<UserQobuzCredential>(e => e.UserProfileId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ProfileSettings configuration (1:1 with UserProfile)
        modelBuilder.Entity<ProfileSettings>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserProfileId).IsUnique();
            entity.Property(e => e.SelectedPlayerType).HasMaxLength(50);
            entity.Property(e => e.SelectedPlayerName).HasMaxLength(200);
            entity.Property(e => e.SelectedPlayerIp).HasMaxLength(50);
            entity.Property(e => e.SelectedPlayerModel).HasMaxLength(200);

            entity.HasOne(e => e.UserProfile)
                  .WithOne(p => p.Settings)
                  .HasForeignKey<ProfileSettings>(e => e.UserProfileId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // GlobalSettings configuration (singleton)
        modelBuilder.Entity<GlobalSettings>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ActiveProfileId).HasMaxLength(100);

            // Seed the singleton row
            entity.HasData(new GlobalSettings { Id = 1, ActiveProfileId = null });
        });
    }
}

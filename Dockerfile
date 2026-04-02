# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Install Node.js for Angular build
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy project file and restore dependencies
COPY *.csproj ./
RUN dotnet restore

# Copy source code
COPY . ./

# Install Angular dependencies and build
WORKDIR /src/bluesound-angular
RUN npm ci
RUN npm run build

# Copy Angular build to wwwroot
WORKDIR /src
RUN rm -rf wwwroot/* && cp -r bluesound-angular/dist/bluesound-angular/browser/* wwwroot/

# Publish .NET app (skip Angular build since we did it manually)
RUN dotnet publish -c Release -o /app/publish -p:SkipAngularBuild=true

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Install dependencies for mDNS/Zeroconf discovery
RUN apt-get update && apt-get install -y --no-install-recommends \
    libavahi-client3 \
    avahi-daemon \
    dbus \
    && rm -rf /var/lib/apt/lists/*

# Copy published app
COPY --from=build /app/publish .

# Copy entrypoint script
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Expose port (8081 because 8080 is often used by host)
EXPOSE 8081

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8081
ENV ASPNETCORE_ENVIRONMENT=Production

# Start the application (entrypoint starts avahi-daemon first)
ENTRYPOINT ["/app/docker-entrypoint.sh"]

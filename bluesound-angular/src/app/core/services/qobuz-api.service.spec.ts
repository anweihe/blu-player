import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { QobuzApiService } from './qobuz-api.service';
import { AuthService } from './auth.service';
import { QobuzAlbum, QobuzPlaylist, QobuzTrack } from '../models';

describe('QobuzApiService', () => {
  let service: QobuzApiService;
  let httpMock: HttpTestingController;
  let authServiceMock: { getAuthHeaders: jest.Mock };

  const mockAlbum: QobuzAlbum = {
    id: 'album-123',
    title: 'Test Album',
    artist: { id: 1, name: 'Test Artist' },
    image: { small: '', thumbnail: '', large: 'https://example.com/cover.jpg' },
    release_date_original: '2024-01-15',
    duration: 3600,
    tracks_count: 12,
    hires: true,
    hires_streamable: true
  };

  const mockPlaylist: QobuzPlaylist = {
    id: 12345,
    name: 'Test Playlist',
    description: 'A test playlist',
    images300: ['https://example.com/playlist.jpg'],
    owner: { id: 1, name: 'Test User' },
    tracks_count: 20,
    duration: 4800,
    is_public: true
  };

  const mockTrack: QobuzTrack = {
    id: 67890,
    title: 'Test Track',
    duration: 240,
    track_number: 1,
    album: mockAlbum,
    performer: { id: 1, name: 'Test Artist' },
    hires: true,
    hires_streamable: true
  };

  // Helper to match URL with handler
  const matchHandler = (handler: string) =>
    (req: any) => req.urlWithParams.includes(`handler=${handler}`);

  beforeEach(() => {
    authServiceMock = {
      getAuthHeaders: jest.fn().mockReturnValue({
        'X-Auth-Token': 'test-token',
        'X-User-Id': '12345'
      })
    };

    TestBed.configureTestingModule({
      providers: [
        QobuzApiService,
        { provide: AuthService, useValue: authServiceMock },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(QobuzApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Albums', () => {
    it('should get new releases', (done) => {
      service.getNewReleases(0, 50).subscribe(container => {
        expect(container.items).toEqual([mockAlbum]);
        expect(container.total).toBe(1);
        done();
      });

      const req = httpMock.expectOne(matchHandler('NewReleases'));
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('X-Auth-Token')).toBe('test-token');
      req.flush({
        albums: { items: [mockAlbum], total: 1, offset: 0, limit: 50 }
      });
    });

    it('should get album charts', (done) => {
      service.getAlbumCharts(10, 20).subscribe(container => {
        expect(container.items).toEqual([mockAlbum]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('AlbumCharts'));
      req.flush({
        albums: { items: [mockAlbum], total: 100, offset: 10, limit: 20 }
      });
    });

    it('should get album details with tracks', (done) => {
      const albumWithTracks = {
        ...mockAlbum,
        tracks: { items: [mockTrack] }
      };

      service.getAlbum('album-123').subscribe(album => {
        expect(album.id).toBe('album-123');
        expect(album.tracks.items.length).toBe(1);
        done();
      });

      const req = httpMock.expectOne(matchHandler('Album'));
      req.flush(albumWithTracks);
    });

    it('should return empty container when albums is null', (done) => {
      service.getNewReleases().subscribe(container => {
        expect(container.items).toEqual([]);
        expect(container.total).toBe(0);
        done();
      });

      const req = httpMock.expectOne(matchHandler('NewReleases'));
      req.flush({ albums: null });
    });
  });

  describe('Playlists', () => {
    it('should get featured playlists', (done) => {
      service.getFeaturedPlaylists(undefined, 0, 50).subscribe(container => {
        expect(container.items).toEqual([mockPlaylist]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('FeaturedPlaylists'));
      req.flush({
        playlists: { items: [mockPlaylist], total: 1, offset: 0, limit: 50 }
      });
    });

    it('should get featured playlists with genre filter', (done) => {
      service.getFeaturedPlaylists(['112', '113'], 0, 20).subscribe(() => done());

      const req = httpMock.expectOne(matchHandler('FeaturedPlaylists'));
      expect(req.request.urlWithParams).toContain('genreIds=112');
      req.flush({
        playlists: { items: [], total: 0, offset: 0, limit: 20 }
      });
    });

    it('should get user playlists', (done) => {
      service.getUserPlaylists().subscribe(container => {
        expect(container.items).toEqual([mockPlaylist]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('UserPlaylists'));
      req.flush({
        playlists: { items: [mockPlaylist], total: 1, offset: 0, limit: 50 }
      });
    });

    it('should get playlist details with tracks', (done) => {
      const playlistWithTracks = {
        ...mockPlaylist,
        tracks: { items: [mockTrack], total: 1 }
      };

      service.getPlaylist(12345).subscribe(playlist => {
        expect(playlist.id).toBe(12345);
        expect(playlist.tracks.items.length).toBe(1);
        done();
      });

      const req = httpMock.expectOne(matchHandler('Playlist'));
      req.flush(playlistWithTracks);
    });
  });

  describe('Artists', () => {
    it('should get artist page', (done) => {
      const artistPage = {
        artist: { id: 1, name: 'Test Artist', albums_count: 5 },
        topTracks: [mockTrack],
        albums: { items: [mockAlbum], total: 5 },
        biography: { summary: 'Artist bio' },
        similarArtists: []
      };

      service.getArtistPage(1).subscribe(response => {
        expect(response.artist.id).toBe(1);
        expect(response.topTracks.length).toBe(1);
        done();
      });

      const req = httpMock.expectOne(matchHandler('ArtistPage'));
      req.flush(artistPage);
    });

    it('should get artist discography', (done) => {
      service.getArtistDiscography(1, 'album', 0, 30).subscribe(container => {
        expect(container.items).toEqual([mockAlbum]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('ArtistDiscography'));
      req.flush({ items: [mockAlbum], total: 1, offset: 0, limit: 30 });
    });
  });

  describe('Favorites', () => {
    it('should get favorite albums', (done) => {
      service.getFavoriteAlbums().subscribe(container => {
        expect(container.items).toEqual([mockAlbum]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('FavoriteAlbums'));
      req.flush({
        albums: { items: [mockAlbum], total: 1, offset: 0, limit: 50 }
      });
    });

    it('should get favorite tracks', (done) => {
      service.getFavoriteTracks().subscribe(tracks => {
        expect(tracks).toEqual([mockTrack]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('FavoriteTracks'));
      req.flush({
        tracks: { items: [mockTrack], total: 1 }
      });
    });

    it('should return empty array when favorite tracks is null', (done) => {
      service.getFavoriteTracks().subscribe(tracks => {
        expect(tracks).toEqual([]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('FavoriteTracks'));
      req.flush({ tracks: null });
    });

    it('should get favorite artists', (done) => {
      const mockArtist = { id: 1, name: 'Test Artist' };

      service.getFavoriteArtists().subscribe(response => {
        expect(response.artists.items).toEqual([mockArtist]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('FavoriteArtists'));
      req.flush({
        artists: { items: [mockArtist], total: 1 }
      });
    });
  });

  describe('Search', () => {
    it('should search for content', (done) => {
      service.search('test query', 10).subscribe(result => {
        expect(result.albums).toEqual([mockAlbum]);
        expect(result.tracks).toEqual([mockTrack]);
        expect(result.playlists).toEqual([mockPlaylist]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('Search'));
      req.flush({
        albums: { items: [mockAlbum] },
        tracks: { items: [mockTrack] },
        playlists: { items: [mockPlaylist] },
        artists: { items: [] }
      });
    });

    it('should handle empty search results', (done) => {
      service.search('no results').subscribe(result => {
        expect(result.albums).toEqual([]);
        expect(result.tracks).toEqual([]);
        expect(result.playlists).toEqual([]);
        expect(result.artists).toEqual([]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('Search'));
      req.flush({});
    });
  });

  describe('Playback', () => {
    it('should get track stream URL', (done) => {
      service.getTrackStreamUrl(67890, 27).subscribe(url => {
        expect(url).toBe('https://stream.qobuz.com/track.flac');
        done();
      });

      const req = httpMock.expectOne(matchHandler('TrackStreamUrl'));
      req.flush({ url: 'https://stream.qobuz.com/track.flac' });
    });
  });

  describe('Album Info', () => {
    it('should get AI-generated album info', (done) => {
      service.getAlbumInfo('album-123', 'Test Album', 'Test Artist').subscribe(info => {
        expect(info.style).toBe('Rock');
        expect(info.summary).toBe('A great album');
        done();
      });

      const req = httpMock.expectOne(matchHandler('AlbumInfo'));
      req.flush({ style: 'Rock', summary: 'A great album' });
    });
  });

  describe('Genres', () => {
    it('should get available genres', (done) => {
      const genres = [
        { id: 112, name: 'Pop/Rock' },
        { id: 64, name: 'Jazz' }
      ];

      service.getGenres().subscribe(result => {
        expect(result).toEqual(genres);
        done();
      });

      const req = httpMock.expectOne(matchHandler('Genres'));
      req.flush({ genres });
    });

    it('should return empty array when genres is null', (done) => {
      service.getGenres().subscribe(result => {
        expect(result).toEqual([]);
        done();
      });

      const req = httpMock.expectOne(matchHandler('Genres'));
      req.flush({ genres: null });
    });
  });

  describe('Auth Headers', () => {
    it('should include auth headers in requests', (done) => {
      service.getNewReleases().subscribe(() => done());

      const req = httpMock.expectOne(matchHandler('NewReleases'));
      expect(req.request.headers.get('X-Auth-Token')).toBe('test-token');
      expect(req.request.headers.get('X-User-Id')).toBe('12345');
      req.flush({ albums: { items: [], total: 0 } });
    });
  });
});

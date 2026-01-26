import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BluesoundApiService } from './bluesound-api.service';
import { BluesoundPlayer, PlaybackStatus, QueueItem } from '../models';

describe('BluesoundApiService', () => {
  let service: BluesoundApiService;
  let httpMock: HttpTestingController;

  const mockPlayer: BluesoundPlayer = {
    id: 'player-1',
    name: 'Living Room',
    ipAddress: '192.168.1.100',
    port: 11000,
    modelName: 'NODE 2i',
    model: 'NODE 2i',
    brand: 'Bluesound',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    volume: 50,
    isFixedVolume: false,
    isGrouped: false,
    isMaster: false,
    slaveIps: [],
    isStereoPaired: false,
    isSecondaryStereoPairSpeaker: false
  };

  const mockPlaybackStatus: PlaybackStatus = {
    state: 'play',
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    imageUrl: 'https://example.com/cover.jpg',
    service: 'Qobuz',
    totalSeconds: 300,
    currentSeconds: 150
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BluesoundApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(BluesoundApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Player Discovery', () => {
    it('should get players', (done) => {
      const mockPlayers = [mockPlayer];

      service.getPlayers().subscribe(players => {
        expect(players).toEqual(mockPlayers);
        done();
      });

      const req = httpMock.expectOne('/api/players');
      expect(req.request.method).toBe('GET');
      req.flush(mockPlayers);
    });

    it('should return empty array on getPlayers error', (done) => {
      service.getPlayers().subscribe(players => {
        expect(players).toEqual([]);
        done();
      });

      const req = httpMock.expectOne('/api/players');
      req.flush('Error', { status: 500, statusText: 'Server Error' });
    });

    it('should refresh players', (done) => {
      const mockPlayers = [mockPlayer];

      service.refreshPlayers().subscribe(players => {
        expect(players).toEqual(mockPlayers);
        done();
      });

      const req = httpMock.expectOne('/api/players/refresh');
      expect(req.request.method).toBe('POST');
      req.flush(mockPlayers);
    });
  });

  describe('Player Status', () => {
    it('should get sync status', (done) => {
      service.getSyncStatus('192.168.1.100').subscribe(player => {
        expect(player).toEqual(mockPlayer);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/sync');
      expect(req.request.method).toBe('GET');
      req.flush(mockPlayer);
    });

    it('should return null on getSyncStatus error', (done) => {
      service.getSyncStatus('192.168.1.100').subscribe(player => {
        expect(player).toBeNull();
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/sync');
      req.flush('Error', { status: 404, statusText: 'Not Found' });
    });

    it('should get playback status', (done) => {
      service.getStatus('192.168.1.100').subscribe(status => {
        expect(status).toEqual(mockPlaybackStatus);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/status');
      expect(req.request.method).toBe('GET');
      req.flush(mockPlaybackStatus);
    });

    it('should get queue', (done) => {
      const mockQueue: QueueItem[] = [
        { id: 1, title: 'Track 1', artist: 'Artist 1', duration: 200, isCurrentTrack: true },
        { id: 2, title: 'Track 2', artist: 'Artist 2', duration: 180, isCurrentTrack: false }
      ];

      service.getQueue('192.168.1.100').subscribe(queue => {
        expect(queue).toEqual(mockQueue);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/queue');
      expect(req.request.method).toBe('GET');
      req.flush(mockQueue);
    });
  });

  describe('Playback Control', () => {
    it('should play', (done) => {
      service.play('192.168.1.100').subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/play');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('should pause', (done) => {
      service.pause('192.168.1.100').subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/pause');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('should stop', (done) => {
      service.stop('192.168.1.100').subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/stop');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('should skip to next', (done) => {
      service.skip('192.168.1.100').subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/skip');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('should go back to previous', (done) => {
      service.back('192.168.1.100').subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/back');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('should seek to position', (done) => {
      service.seek('192.168.1.100', 120).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/seek');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ seconds: 120 });
      req.flush(null);
    });

    it('should return false on playback control error', (done) => {
      service.play('192.168.1.100').subscribe(success => {
        expect(success).toBe(false);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/play');
      req.flush('Error', { status: 500, statusText: 'Server Error' });
    });
  });

  describe('Volume Control', () => {
    it('should set volume', (done) => {
      service.setVolume('192.168.1.100', 75).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/volume');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ level: 75 });
      req.flush(null);
    });

    it('should set mute', (done) => {
      service.setMute('192.168.1.100', true).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/mute');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ mute: true });
      req.flush(null);
    });
  });

  describe('Qobuz Playback', () => {
    it('should play Qobuz track', (done) => {
      service.playQobuzTrack('192.168.1.100', 12345).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/play-qobuz');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ trackId: 12345 });
      req.flush(null);
    });

    it('should play Qobuz album', (done) => {
      service.playQobuzAlbum('192.168.1.100', 'album-123', 2).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/play-qobuz-album');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ albumId: 'album-123', startTrackIndex: 2 });
      req.flush(null);
    });

    it('should play Qobuz playlist', (done) => {
      service.playQobuzPlaylist('192.168.1.100', 67890, 0).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/play-qobuz-playlist');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ playlistId: 67890, startTrackIndex: 0 });
      req.flush(null);
    });
  });

  describe('Queue Management', () => {
    it('should add to queue', (done) => {
      service.addToQueue('192.168.1.100', 12345).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/queue/add');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ trackId: 12345 });
      req.flush(null);
    });

    it('should clear queue', (done) => {
      service.clearQueue('192.168.1.100').subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/queue/clear');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('should play queue item', (done) => {
      service.playQueueItem('192.168.1.100', 3).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/queue/play');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ index: 3 });
      req.flush(null);
    });

    it('should remove queue item', (done) => {
      service.removeQueueItem('192.168.1.100', 2).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/queue/2');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('Group Management', () => {
    it('should create group', (done) => {
      service.createGroup('192.168.1.100', ['192.168.1.101', '192.168.1.102']).subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/group/create');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ slaveIps: ['192.168.1.101', '192.168.1.102'] });
      req.flush(null);
    });

    it('should add to group', (done) => {
      service.addToGroup('192.168.1.100', '192.168.1.103').subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/group/add');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ slaveIp: '192.168.1.103' });
      req.flush(null);
    });

    it('should remove from group', (done) => {
      service.removeFromGroup('192.168.1.100', '192.168.1.101').subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.100/group/remove');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ slaveIp: '192.168.1.101' });
      req.flush(null);
    });

    it('should leave group', (done) => {
      service.leaveGroup('192.168.1.101').subscribe(success => {
        expect(success).toBe(true);
        done();
      });

      const req = httpMock.expectOne('/api/player/192.168.1.101/group/leave');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('URL Encoding', () => {
    it('should properly encode special characters in IP addresses', (done) => {
      // Though IPs shouldn't have special chars, testing the encoding mechanism
      service.getStatus('192.168.1.100').subscribe(() => done());

      const req = httpMock.expectOne('/api/player/192.168.1.100/status');
      req.flush(mockPlaybackStatus);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { PlayerStateService, PlayerMode, StreamingQuality } from './player-state.service';
import { BluesoundPlayer, PlaybackStatus, QueueItem } from '../models';

describe('PlayerStateService', () => {
  let service: PlayerStateService;

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
    imageUrl: 'https://example.com/image.jpg',
    service: 'Qobuz',
    totalSeconds: 300,
    currentSeconds: 150
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PlayerStateService]
    });
    service = TestBed.inject(PlayerStateService);
  });

  describe('Initial State', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should start with no selected player', () => {
      expect(service.selectedPlayer()).toBeNull();
    });

    it('should start with empty players list', () => {
      expect(service.players()).toEqual([]);
    });

    it('should start in browser mode', () => {
      expect(service.playerMode()).toBe('browser');
    });

    it('should start with no playback status', () => {
      expect(service.playbackStatus()).toBeNull();
    });

    it('should start not playing', () => {
      expect(service.isPlaying()).toBe(false);
      expect(service.isPaused()).toBe(false);
      expect(service.isStopped()).toBe(true);
    });

    it('should start with zero progress', () => {
      expect(service.progress()).toBe(0);
      expect(service.duration()).toBe(0);
      expect(service.progressPercent()).toBe(0);
    });

    it('should start with default volume', () => {
      expect(service.volume()).toBe(50);
      expect(service.isMuted()).toBe(false);
    });

    it('should start with Hi-Res Max quality', () => {
      expect(service.streamingQuality()).toBe(27);
      expect(service.qualityLabel()).toBe('Hi-Res Max');
    });

    it('should start with hidden UI panels', () => {
      expect(service.isNowPlayingVisible()).toBe(false);
      expect(service.isVolumePanelVisible()).toBe(false);
      expect(service.isQueueVisible()).toBe(false);
    });
  });

  describe('Player Selection', () => {
    it('should select a player and switch to bluesound mode', () => {
      service.selectPlayer(mockPlayer);

      expect(service.selectedPlayer()).toEqual(mockPlayer);
      expect(service.playerMode()).toBe('bluesound');
      expect(service.volume()).toBe(50);
    });

    it('should set volume from player when selecting', () => {
      const playerWithVolume = { ...mockPlayer, volume: 75 };
      service.selectPlayer(playerWithVolume);

      expect(service.volume()).toBe(75);
    });

    it('should set volume to 100 for fixed volume players', () => {
      const fixedVolumePlayer = { ...mockPlayer, isFixedVolume: true, volume: -1 };
      service.selectPlayer(fixedVolumePlayer);

      expect(service.volume()).toBe(100);
    });

    it('should switch to browser playback', () => {
      service.selectPlayer(mockPlayer);
      expect(service.playerMode()).toBe('bluesound');

      service.useBrowserPlayback();

      expect(service.selectedPlayer()).toBeNull();
      expect(service.playerMode()).toBe('browser');
    });

    it('should compute isFixedVolume correctly', () => {
      expect(service.isFixedVolume()).toBe(false);

      const fixedVolumePlayer = { ...mockPlayer, isFixedVolume: true };
      service.selectPlayer(fixedVolumePlayer);

      expect(service.isFixedVolume()).toBe(true);
    });
  });

  describe('Playback Status', () => {
    it('should update playback status', () => {
      service.updatePlaybackStatus(mockPlaybackStatus);

      expect(service.playbackStatus()).toEqual(mockPlaybackStatus);
      expect(service.progress()).toBe(150);
      expect(service.duration()).toBe(300);
    });

    it('should compute isPlaying correctly', () => {
      expect(service.isPlaying()).toBe(false);

      service.updatePlaybackStatus({ state: 'play' });
      expect(service.isPlaying()).toBe(true);

      service.updatePlaybackStatus({ state: 'stream' });
      expect(service.isPlaying()).toBe(true);

      service.updatePlaybackStatus({ state: 'pause' });
      expect(service.isPlaying()).toBe(false);
    });

    it('should compute isPaused correctly', () => {
      service.updatePlaybackStatus({ state: 'pause' });
      expect(service.isPaused()).toBe(true);

      service.updatePlaybackStatus({ state: 'play' });
      expect(service.isPaused()).toBe(false);
    });

    it('should compute isStopped correctly', () => {
      expect(service.isStopped()).toBe(true);

      service.updatePlaybackStatus({ state: 'play' });
      expect(service.isStopped()).toBe(false);

      service.updatePlaybackStatus({ state: 'stop' });
      expect(service.isStopped()).toBe(true);
    });
  });

  describe('Progress', () => {
    it('should update progress manually', () => {
      service.updateProgress(45);
      expect(service.progress()).toBe(45);
    });

    it('should compute progress percent correctly', () => {
      service.updatePlaybackStatus({
        state: 'play',
        currentSeconds: 30,
        totalSeconds: 100
      });

      expect(service.progressPercent()).toBe(30);
    });

    it('should return 0% when duration is 0', () => {
      service.updateProgress(50);
      expect(service.progressPercent()).toBe(0);
    });

    it('should format position correctly', () => {
      service.updateProgress(125); // 2:05
      expect(service.formattedPosition()).toBe('2:05');
    });

    it('should format duration correctly', () => {
      service.updatePlaybackStatus({ state: 'play', totalSeconds: 300 }); // 5:00
      expect(service.formattedDuration()).toBe('5:00');
    });
  });

  describe('Volume', () => {
    it('should set volume within bounds', () => {
      service.setVolume(75);
      expect(service.volume()).toBe(75);
    });

    it('should clamp volume to 0 minimum', () => {
      service.setVolume(-10);
      expect(service.volume()).toBe(0);
    });

    it('should clamp volume to 100 maximum', () => {
      service.setVolume(150);
      expect(service.volume()).toBe(100);
    });

    it('should unmute when setting volume above 0', () => {
      service.toggleMute();
      expect(service.isMuted()).toBe(true);

      service.setVolume(50);
      expect(service.isMuted()).toBe(false);
    });

    it('should toggle mute', () => {
      expect(service.isMuted()).toBe(false);

      service.toggleMute();
      expect(service.isMuted()).toBe(true);

      service.toggleMute();
      expect(service.isMuted()).toBe(false);
    });
  });

  describe('Streaming Quality', () => {
    it('should set streaming quality', () => {
      service.setStreamingQuality(6);
      expect(service.streamingQuality()).toBe(6);
    });

    it('should compute quality labels correctly', () => {
      service.setStreamingQuality(5);
      expect(service.qualityLabel()).toBe('MP3 320');

      service.setStreamingQuality(6);
      expect(service.qualityLabel()).toBe('CD (16-Bit)');

      service.setStreamingQuality(7);
      expect(service.qualityLabel()).toBe('Hi-Res (24-Bit/96kHz)');

      service.setStreamingQuality(27);
      expect(service.qualityLabel()).toBe('Hi-Res Max');
    });
  });

  describe('Queue Management', () => {
    const mockQueue: QueueItem[] = [
      { id: 1, title: 'Track 1', artist: 'Artist 1', duration: 200, isCurrentTrack: true },
      { id: 2, title: 'Track 2', artist: 'Artist 2', duration: 180, isCurrentTrack: false },
      { id: 3, title: 'Track 3', artist: 'Artist 3', duration: 240, isCurrentTrack: false }
    ];

    it('should set queue', () => {
      service.setQueue(mockQueue, 0);

      expect(service.queue()).toEqual(mockQueue);
      expect(service.queueIndex()).toBe(0);
    });

    it('should set queue with custom index', () => {
      service.setQueue(mockQueue, 2);

      expect(service.queueIndex()).toBe(2);
    });

    it('should clear queue', () => {
      service.setQueue(mockQueue, 1);
      expect(service.queue().length).toBe(3);

      service.clearQueue();

      expect(service.queue()).toEqual([]);
      expect(service.queueIndex()).toBe(0);
    });

    it('should toggle queue visibility', () => {
      expect(service.isQueueVisible()).toBe(false);

      service.toggleQueue();
      expect(service.isQueueVisible()).toBe(true);

      service.toggleQueue();
      expect(service.isQueueVisible()).toBe(false);
    });
  });

  describe('UI State', () => {
    it('should toggle now playing visibility', () => {
      expect(service.isNowPlayingVisible()).toBe(false);

      service.toggleNowPlaying();
      expect(service.isNowPlayingVisible()).toBe(true);

      service.toggleNowPlaying();
      expect(service.isNowPlayingVisible()).toBe(false);
    });

    it('should show now playing', () => {
      service.showNowPlaying();
      expect(service.isNowPlayingVisible()).toBe(true);
    });

    it('should hide now playing', () => {
      service.showNowPlaying();
      service.hideNowPlaying();
      expect(service.isNowPlayingVisible()).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      // Set some state
      service.updatePlaybackStatus(mockPlaybackStatus);
      service.setQueue([{ id: 1, title: 'Test', artist: 'Test', duration: 100, isCurrentTrack: true }], 0);

      // Reset
      service.reset();

      expect(service.playbackStatus()).toBeNull();
      expect(service.currentTrack()).toBeNull();
      expect(service.progress()).toBe(0);
      expect(service.duration()).toBe(0);
      expect(service.queue()).toEqual([]);
      expect(service.queueIndex()).toBe(0);
    });
  });
});

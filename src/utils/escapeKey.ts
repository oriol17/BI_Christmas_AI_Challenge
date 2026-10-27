import Phaser from 'phaser';

/**
 * Registers an Escape handler that works even when an embedding host (iframe wrappers,
 * IDE preview browsers, extensions) has already called preventDefault on the event.
 * Phaser's keyboard manager ignores default-prevented events, so Escape is read from the
 * DOM directly. The handler only fires while the scene is running and is removed on shutdown.
 */
export function onEscapeKey(scene: Phaser.Scene, handler: () => void): void {
  const listener = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.repeat || !scene.sys.isActive()) return;
    handler();
  };
  window.addEventListener('keydown', listener);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', listener));
}

// Lightweight fake socket implementing the slice of socket.io-client
// that SocketIoSignalingClient touches.

type Listener = (...args: unknown[]) => void;

export class FakeSocket {
  public connected = false;
  public emitted: Array<{ event: string; args: unknown[] }> = [];
  private readonly handlers = new Map<string, Listener[]>();
  private readonly onceHandlers = new Map<string, Listener[]>();
  public connectCalls = 0;
  public disconnectCalls = 0;
  public ackResponses: Record<string, unknown> = {};

  emit(event: string, ...args: unknown[]): void {
    this.emitted.push({ event, args });
    // If the last argument is a function (ack), pull a canned response.
    const last = args[args.length - 1];
    if (typeof last === 'function' && this.ackResponses[event] !== undefined) {
      (last as (response: unknown) => void)(this.ackResponses[event]);
    }
  }

  on(event: string, handler: Listener): this {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  once(event: string, handler: Listener): this {
    const list = this.onceHandlers.get(event) ?? [];
    list.push(handler);
    this.onceHandlers.set(event, list);
    return this;
  }

  off(event: string, handler: Listener): this {
    const live = (this.handlers.get(event) ?? []).filter((h) => h !== handler);
    this.handlers.set(event, live);
    const once = (this.onceHandlers.get(event) ?? []).filter((h) => h !== handler);
    this.onceHandlers.set(event, once);
    return this;
  }

  connect(): this {
    this.connectCalls += 1;
    return this;
  }

  disconnect(): this {
    this.disconnectCalls += 1;
    this.connected = false;
    return this;
  }

  // ---- Test helpers ----

  fire(event: string, ...args: unknown[]): void {
    for (const h of this.handlers.get(event) ?? []) h(...args);
    const once = this.onceHandlers.get(event) ?? [];
    this.onceHandlers.set(event, []);
    for (const h of once) h(...args);
  }
}

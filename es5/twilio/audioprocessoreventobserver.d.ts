import { EventEmitter } from 'events';
/**
 * AudioProcessorEventObserver observes {@link AudioProcessor}
 * related operations and re-emits them as generic events.
 * @internal
 */
export declare class AudioProcessorEventObserver extends EventEmitter {
    private _log;
    constructor();
    destroy(): void;
    private _reEmitEvent;
}

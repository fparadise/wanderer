// Browser-safe shim for Node 'stream' module required by legacy CommonJS bundles
export class Stream {}
export class Readable extends Stream {
    pipe() { return this; }
}
export class Writable extends Stream {
    write() { return true; }
    end() {}
}
export class Duplex extends Stream {}
export class Transform extends Stream {}
export class PassThrough extends Stream {}

export default {
    Stream,
    Readable,
    Writable,
    Duplex,
    Transform,
    PassThrough
};

/*
    A printer on the network: the bonny print server on the node the playground
    is served from. It takes raw ESC/POS bytes on `api/print` and writes them to
    the printer attached to the node, so the browser needs no USB at all.

    It looks like the other drivers to the rest of the page: connect() reports
    `connected`, print() sends the bytes, disconnect() reports `disconnected`.
    Connecting asks the server whether the printer is there, and does not keep
    anything open: every print is a request of its own.

    The address is relative to the page, so the server is found on whatever
    host and path the playground is served from.
*/

const endpoint = (name) => new URL(`api/${name}`, document.baseURI).href;

class NetworkReceiptPrinter {

    #listeners = {};

    addEventListener(name, callback) {
        (this.#listeners[name] ||= []).push(callback);
    }

    #emit(name, ...args) {
        (this.#listeners[name] || []).forEach(callback => callback(...args));
    }

    /* What the server says about itself, or why it said nothing */

    async #health() {
        let response = await fetch(endpoint('health'), { cache: 'no-store' });
        let body = await response.json().catch(() => ({}));

        if (!response.ok || !body.writable) {
            throw new Error(body.error || (body.exists === false ?
                'The printer is not connected to the node' :
                `The print server answered ${response.status}`));
        }

        return body;
    }

    async connect() {
        await this.#health();

        /* The printer on the node is an Epson that speaks ESC/POS, which is
           what the encoder is told; the model picked in the header does the rest */

        this.#emit('connected', {
            type: 'network',
            manufacturerName: 'bonny',
            productName: 'Printer on the node',
            language: 'esc-pos',
            codepageMapping: 'epson',
        });
    }

    async print(data) {
        let response = await fetch(endpoint('print'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: data,
        });

        if (!response.ok) {
            let body = await response.json().catch(() => ({}));
            throw new Error(body.error || `The print server answered ${response.status}`);
        }
    }

    disconnect() {
        this.#emit('disconnected');
    }
}

export default NetworkReceiptPrinter;

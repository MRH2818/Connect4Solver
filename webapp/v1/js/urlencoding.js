// OBJECT to BASE64
function encodeOBJtoBASE64_URL(obj) {
    return encodeURIComponent(btoa(
        String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj)))
    ));
}
// BASE64 to OBJECT
function decodeBASE64_URLtoOBJ(str) {
    return JSON.parse(
        new TextDecoder().decode(
            Uint8Array.from(atob(decodeURIComponent(str)), c => c.charCodeAt(0))
        )
    );
}

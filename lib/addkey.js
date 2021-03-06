/**
 * adds a key to a keystore and returns the JWK
 *
 * SYNOPSIS:
 *
 * addkey [-q -U -C --update --quiet --create] [-j KEYSTORE] [KEYFILE ...]
 *
 * Addkey is the tool for adding keys to a keystore. If no keyfile is provided,
 * then addkey reads the key from STDIN.
 *
 * Addkey handles JWK, JWKS, PEM, DER, PKCS#8, PKIX, SPKI, and X509 formats.
 * If another keystore is presented for import, all keys are imported.
 *
 * Addkey tries to import all provided keyfiles.
 *
 * -C, --create creates a new keystore if the keystore file is not present.
 *
 * -j, --jwks, --keystore KEYSTORE loads the given keystore.
 *
 * -q, --quiet generates no output. This flag omits the output of the keystore.
 *
 * -U, --update updates the provided keystore.
 */

const { JWK } = require("node-jose");

const { loadFile, loadKeyStore } = require("./helper/readfile");

async function loadKey(fn, keystore) {
    let key;

    try {
        key = await loadFile(fn);
    }
    catch (err) {
        return false;
    }

    try {
        await keystore.add(key);
    }
    catch (err) {
        try {
            await keystore.add(key, "pem");
        }
        catch (err) {
            try {
                await keystore.add(key, "pkcs8");
            }
            catch (err) {
                try {
                    await keystore.add(key, "x509");
                }
                catch (err) {
                    try {
                        await keystore.add(key, "pkix");
                    }
                    catch (err) {
                        try {
                            await keystore.add(key, "spki");
                        }
                        catch(err) {
                            // merge key stores
                            const ks = await JWK.asKeyStore(key);

                            await Promise.all(ks.all().map((k) => keystore.add(k)));
                        }
                    }
                }
            }
        }
    }

    return true;
}

module.exports = async function (args) {
    // tool [kstore [keyfile ...]]
    args = require("minimist")(args, {boolean: ["U", "update", "q", "quiet", "C", "create"]});
    const jwksFn = args.j || args.jwks || args.keystore;

    if (!(args.C || args.create) && !jwksFn || jwksFn === "--") {
        throw new Error("no keystore file provided");
    }

    const jwks = await loadKeyStore(jwksFn, args.C || args.create);

    if (args._.length) {
        await Promise.all(args._.map((fn) => loadKey(fn, jwks)));
    }
    else {
        await loadKey("--", jwks);
    }

    const json = await jwks.toJSON(true);

    if (args.U || args.update) {
        await new Promise((resolve, reject) => require("fs").writeFile(jwksFn, JSON.stringify(json), (err) => err ? reject(err) : resolve()));
    }

    if (!(args.q || args.quiet)) {
        process.stdout.write(JSON.stringify(json), "utf8");
    }
};

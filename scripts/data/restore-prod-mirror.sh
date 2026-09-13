#!/usr/bin/env bash
#
# Restore the production BSON dumps into a LOCAL database, gusi_prod_mirror.
#
# The mirror is the fidelity target: `pnpm fidelity` replays every document in
# it through the api-client schemas. It is restored from the dumps that already
# sit beside this repo, never from the cluster, and it is a separate database
# from gusi_dev so that development writes cannot drift the reference.
#
# Refuses to run against anything that is not local. The production cluster
# is read-only by rule, and the one way a restore script can break that rule
# is by being handed the wrong URI.
#
#   scripts/data/restore-prod-mirror.sh [dumps-root]
#
# dumps-root defaults to the folder above this repo, where the dumps live.
set -euo pipefail

MIRROR_URI="${SECTOR_MIRROR_MONGODB_URI:-mongodb://localhost:27017/?directConnection=true}"
MIRROR_DB="${SECTOR_MIRROR_DB:-gusi_prod_mirror}"
DUMPS_ROOT="${1:-$(cd "$(dirname "$0")/../../.." && pwd)}"

case "$MIRROR_URI" in
  *mongodb.net*|*mongodb+srv*|*atlas*)
    echo "refusing: '$MIRROR_URI' does not look local. The mirror only ever lives on localhost." >&2
    exit 2
    ;;
esac
case "$MIRROR_DB" in
  gusi|gusi_dev|gusi_test)
    echo "refusing: '$MIRROR_DB' is a working database, not a mirror. Pick another name." >&2
    exit 2
    ;;
esac

# The production dumps. Each is a mongodump root holding a `gusi/` directory;
# pointing mongorestore at the `gusi/` directory itself restores nothing and
# exits 0 (docs/mongo-data-loss-12-sep-2026.md, trap 1).
DUMPS=(dump-prod-content dump-prod-scans dump-prod-scan-owners)

# The users. `dump-prod-scan-owners` holds five documents, so restored on its
# own the mirror has 31,487 scans and almost no owners: every populated `user`
# on a scan, a review or a note would come back null and the replay would report
# thirty thousand copies of a shape production never sends. The complete set of
# 3,151 production users survives in exactly one place, the local backup taken
# after the 12 Sep recovery, so the users collection is taken from there.
USERS_DUMP=dump-local-gusi-dev-260912
USERS_NS=gusi_dev.users

for dump in "${DUMPS[@]}"; do
  if [ ! -d "$DUMPS_ROOT/$dump/gusi" ]; then
    echo "missing: $DUMPS_ROOT/$dump/gusi" >&2
    exit 1
  fi
done
if [ ! -f "$DUMPS_ROOT/$USERS_DUMP/gusi_dev/users.bson" ]; then
  echo "missing: $DUMPS_ROOT/$USERS_DUMP/gusi_dev/users.bson" >&2
  exit 1
fi

echo "restoring ${DUMPS[*]} -> $MIRROR_DB on $MIRROR_URI"
for dump in "${DUMPS[@]}"; do
  # --drop makes a re-run idempotent for the collections in the dump; the
  # first dump also drops anything a previous restore left behind.
  mongorestore --uri="$MIRROR_URI" \
    --nsFrom='gusi.*' --nsTo="$MIRROR_DB.*" \
    --drop --quiet \
    "$DUMPS_ROOT/$dump"
done

echo "restoring users from $USERS_DUMP -> $MIRROR_DB.users"
mongorestore --uri="$MIRROR_URI" \
  --nsInclude="$USERS_NS" \
  --nsFrom='gusi_dev.*' --nsTo="$MIRROR_DB.*" \
  --drop --quiet \
  "$DUMPS_ROOT/$USERS_DUMP"

mongosh --quiet "$MIRROR_URI" --eval "
  const db = db.getSiblingDB('$MIRROR_DB');
  const names = db.getCollectionNames().sort();
  let total = 0;
  for (const name of names) { const n = db[name].estimatedDocumentCount(); total += n; print(name.padEnd(28), n); }
  print('collections', names.length, 'documents', total);
"

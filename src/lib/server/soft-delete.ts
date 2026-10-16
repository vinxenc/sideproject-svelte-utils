// Soft delete for the app's own tables (media, album, password; not Better Auth's, and not the album_media
// join table, whose rows are links). `delete` and `deleteMany` set `deletedAt`, and reads and updates skip
// deleted rows. Pass `deletedAt` in a `where` (e.g. `{ not: null }`) to see them, to restore or to purge.
// Only top-level calls on the extended client are covered: nested `include`/`select` relation filters,
// nested writes, raw SQL, `prismaBase` and DB-level cascades from a hard-deleted user still see every row.
// A delete runs on `prismaBase`, so inside an interactive transaction it does not join the transaction.

const FILTERED = new Set([
	'findFirst',
	'findFirstOrThrow',
	'findMany',
	'findUnique',
	'findUniqueOrThrow',
	'count',
	'aggregate',
	'groupBy',
	'update',
	'updateMany'
]);

type Where = { where?: object } | undefined;
type Writer = {
	update(args: object): Promise<unknown>;
	updateMany(args: object): Promise<unknown>;
};

/** The `$allModels.$allOperations` hook; `delegates` maps a model name to its base (unextended) delegate. */
export function softDelete(delegates: Record<string, Writer>) {
	return async ({
		model,
		operation,
		args,
		query
	}: {
		model: string;
		operation: string;
		args: object | undefined;
		query: (args: never) => PromiseLike<unknown>;
	}) => {
		const delegate = delegates[model];
		if (!delegate) return query(args as never);
		const scoped = { ...args, where: { deletedAt: null, ...(args as Where)?.where } };
		if (operation === 'delete')
			return delegate.update({ ...scoped, data: { deletedAt: new Date() } });
		if (operation === 'deleteMany')
			return delegate.updateMany({ where: scoped.where, data: { deletedAt: new Date() } });
		return query((FILTERED.has(operation) ? scoped : args) as never);
	};
}

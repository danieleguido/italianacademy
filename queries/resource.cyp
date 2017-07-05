// name: merge
// merge resource node
MERGE (res:resource:book {uuid:{uuid}})
SET 
res.slug = {slug},
res.title = {title},
res.name = {name},

res.type_search = 'resource',
res.abstract = {abstract},
res.languages = {languages},
res.start_year = {start_year},
res.start_month = {start_month},
res.end_year = {end_year},
res.end_month = {end_month},
RETURN res
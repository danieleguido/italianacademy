// name: merge_person
// merge person node.
MERGE (ent:entity:person {uuid:{uuid}})
SET
  ent.slug = {slug},
  ent.name = {name},
  ent.description = {description},
  ent.first_name = {first_name},
  ent.last_name = {last_name},
  ent.birth_date = {birth_date},
  ent.death_date = {death_date}
RETURN ent

// name: merge_topic
// merge entity node
MERGE (ent:entity:topic {uuid:{uuid}})
SET 
  ent.slug = {slug},
  ent.name = {name}
RETURN ent

// name: merge_appears_in_relationship
// create appears_in relationships
MATCH (s:entity {uuid: {ent__uuid}}), (t:resource {uuid: {res__uuid}})
WITH s, t
MERGE (s)-[r:appears_in]->(t)
SET r.frequency = {frequency}
RETURN r


// name: merge_relationship
// create appears_in relationships
MATCH (s:entity {uuid: {ent__uuid}}), (t:resource {uuid: {res__uuid}})
WITH s, t
MERGE (s)-[r:{=relationship_type}]->(t)
RETURN r


// name: merge_location
// 
MERGE (ent:entity:location:{=location_type} {uuid:{uuid}})
SET
  ent.slug = {slug},
  ent.name = {name},
  ent.description = {description}
RETURN ent



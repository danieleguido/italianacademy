const async     = require("async"),
      fs        = require("fs"),
      glob      = require("glob"),
      clc       = require('cli-color'),
      decypher  = require('decypher'),

      utils     = require('./utils'),
      settings  = require('./settings'),
      _         = require('lodash'),

      query     = {
        resource: decypher('./queries/resource.cyp'),
        entity: decypher('./queries/entity.cyp')
      },

      neo4j    = require('neo4j-driver').v1,
      driver   = neo4j.driver(settings.neo4j.server, neo4j.auth.basic(settings.neo4j.auth.user, settings.neo4j.auth.password)),
      session  = driver.session();



console.log(clc.blackBright('\n--------------------------\n',clc.magentaBright('italianacademiesdiscovery!'),'\n============================\n'))
console.log(clc.blackBright('Reading JSON files in'), clc.cyanBright(settings.path));



glob(settings.path, {}, (err, files) => {
  if(err)
    throw err
  let lfiles = files.length;
  // foreach matching glob path...
  console.log('\n',files.length, clc.blackBright('files found in'), clc.cyanBright(settings.path));

  // openfile
  let q = async.queue((filepath, nextFilepath) => {
    console.log('\n',lfiles-q.length(), clc.blackBright('/',lfiles))
    console.log(clc.blackBright(' evaluating'), clc.cyanBright(filepath));
    
    async.waterfall([
      // start waterfall (timing etc..)
      utils.waterfall.start,

      // prepare readjson with the current filename;
      (opt, next) => {
        opt.filepath = filepath;
        opt.nodes = {}
        next(null, opt)
      },

      // read json file given as opt.filepath
      utils.waterfall.readJson,

      // with opt.data filled by one resource, let's start filling: resource node.
      (opt, next) => {
        console.log(clc.blackBright('executing query:', clc.yellowBright('query.resource.merge'), 'with uuid:'), clc.cyanBright(opt.data.slug));
        session
          .run(query.resource.merge, {
            uuid: opt.data.slug,
            slug: opt.data.slug,
            name: opt.data.title,
            title: opt.data.title,
            abstract: opt.data.abstract,
            languages: opt.data.languages
          }).then( res => {
            opt.nodes.book = res.records[0]._fields[0]
            console.log(clc.greenBright(' ok'), clc.blackBright('success, node:'), opt.nodes.book.properties.name)
            next(null, opt)
          }).catch(next); 
      },

      // create subjects nodes
      (opt, next) => {
        async.series(opt.data.subjects.map( subject => callback => {
          console.log(clc.blackBright('executing query:', clc.yellowBright('query.entity.merge_topic'), 'with slug:'), clc.cyanBright(subject.slug));
          // console.log(subject)
          session
            .run(query.entity.merge_topic, {
              uuid: subject.slug,
              slug: subject.slug,
              name: subject.name
            }).then(res => {
              console.log(clc.greenBright(' ok'), clc.blackBright('success, node:'), res.records[0]._fields[0].properties.name);
              callback(null, res.records[0]._fields[0]);
            }).catch(callback);

        }), (err, results) => {
          if(err)
            next(err)
          else{
            opt.nodes.subjects = results;
            // console.log(results)
            next(null, opt)
          }
        })
      },

      // create people nodes
      (opt, next) => {
     
        let _people = person => callback => {
          console.log(clc.blackBright('executing query:', clc.yellowBright('query.entity.merge_person'), 'with slug:'), clc.cyanBright(person.slug));
          
          // 
          //       {
          //   "slug": "marta-horatio",
          //   "name": "Marta, Horatio, , ",
          //   "first_name": "Horatio",
          //   "last_name": "Marta",
          //   "birth_date": "",
          //   "death_date": "",
          //   "_id": 17414,
          //   "uuid": "022-000004267",
          //   "description": ""
          // },
          session
            .run(query.entity.merge_person, {
              uuid: person.uuid,
              slug: person.slug,
              name: person.name,
              first_name: person.first_name,
              last_name: person.last_name,
              birth_date: person.birth_date,
              death_date: person.death_date,
              description: person.description
            }).then(res => {
              console.log(clc.greenBright(' ok'), clc.blackBright('success, node name:'),res.records[0]._fields[0].properties.name);
              var per = res.records[0]._fields[0];
              per.__role = person.role;
              callback(null, per);
            }).catch(callback);

        };
        // console.log('sjfojfoisdjfoi', _people)
        async.series(opt.data.authors.map(_people).concat(
          opt.data.editors.map(_people),
          opt.data.contributors.map(_people),
          opt.data.dedicatee.map(_people),
          opt.data.censors.map(_people),
          opt.data.illustrators.map(_people)
        ), (err, results) => {
          if(err)
            next(err)
          else{
            opt.nodes.persons = results;
            // console.log(results)
            next(null, opt)
          }
        })
      },

      // create location nodes
      (opt, next) => {
     
        let _location = location => callback => {
          console.log(clc.blackBright('executing query:', clc.yellowBright('query.entity.merge_location'), 'with slug:'), clc.cyanBright(location.slug), location.location_type);
          
          session
            .run(utils.cypher.prepare(query.entity.merge_location, {
              location_type: location.location_type
            }), {
              uuid: location.uuid,
              slug: location.slug,
              name: location.name,
              description: location.description
            }).then(res => {
              console.log(clc.greenBright(' ok'), clc.blackBright('success, node name:'), res.records[0]._fields[0].properties.name);
              callback(null, res.records[0]._fields[0]);
            }).catch(callback);
          
        };
        // console.log('sjfojfoisdjfoi', _location)
        async.series(opt.data.academies.map(_location).concat(_.map(opt.data.academies, 'city').map(_location)), (err, results) => {
          if(err)
            next(err)
          else{
            // let label = _.groupBy(results, 'labels')
            opt.nodes.locations = results;
            // console.log(results)
            next(null, opt)
          }
        })
      },

      // create appears_in relationship
      (opt, next) => {
        let _entity = entity => callback => {
          console.log(clc.blackBright('\nexecuting query:', clc.yellowBright('query.entity.merge_appears_in_relationship')));
          console.log(clc.blackBright(' - entity:'), entity.properties.uuid)
          console.log(clc.blackBright(' - resource:'), opt.nodes.book.properties.uuid)
          // console.log(query.entity.merge_appears_in_relationship)
          session
            .run(query.entity.merge_appears_in_relationship, {
              ent__uuid: entity.properties.uuid,
              res__uuid: opt.nodes.book.properties.uuid,
              frequency: 1
            }).then(res => {
              if(!res.records || !res.records.length){
                callback('merge relationship failed')
              } else {
                console.log(clc.greenBright(' ok'), clc.blackBright('success, relationship created.'));
                callback(null, res.records[0]._fields[0]);
              }
              // callback(null, res.records[0]._fields[0]);
            }).catch(callback);
        }

        async.series(opt.nodes.subjects.map( _entity ).concat(opt.nodes.persons.map( _entity ), opt.nodes.locations.map( _entity )), (err, results) => {
          if(err)
            next(err)
          else{
            // opt.nodes.subjects = results;
            // console.log(results)
            console.log(clc.blackBright('success, created:', clc.greenBright(results.length), '/', opt.nodes.subjects.length, 'relationships'));
            next(null, opt)
          }
        })
      },

      // create role relationship
      (opt, next) => {
        let _entity = entity => callback => {

          // create role defined relationship
          console.log(clc.blackBright('\nexecuting query:', clc.yellowBright('query.entity.merge_role_relationship')));
          console.log(clc.blackBright(' - entity:'), entity.properties.uuid)
          console.log(clc.blackBright(' - resource:'), opt.nodes.book.properties.uuid)
          
          session
            .run(utils.cypher.prepare(query.entity.merge_relationship, {
              relationship_type: 'is_' + entity.__role
            }), {
              ent__uuid: entity.properties.uuid,
              res__uuid: opt.nodes.book.properties.uuid,
              frequency: 1
            }).then(res => {
              if(!res.records || !res.records.length){
                callback('merge relationship failed')
              } else {
                console.log(clc.greenBright(' ok'), clc.blackBright('success, relationship', clc.yellowBright(res.records[0]._fields[0].type),'created.'));
                callback(null, res.records[0]._fields[0]);
              }
              // callback(null, res.records[0]._fields[0]);
            }).catch(callback);

        }

        async.series(opt.nodes.persons.map( _entity ), (err, results) => {
          if(err)
            next(err)
          else{
            // opt.nodes.subjects = results;
            // console.log(results)
            console.log(clc.blackBright('success, created:', clc.greenBright(results.length), '/', opt.nodes.subjects.length, 'relationships'));
            next(null, opt)
          }
        })
      }

    ], err => {
      
      if(err)
        throw err;
      else nextFilepath()
    });

  })

  q.push(files);

  q.drain = () =>{
    console.log("That's all.");
    session.close();
      driver.close();

  }
      // save neo4j nodes and connections


})


// var mysql      = require('mysql');
// var connection = mysql.createConnection({
//   host     : 'localhost',
//   user     : 'me',
//   password : 'secret',
//   database : 'my_db'
// });

// connection.connect();

// connection.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
//   if (error) throw error;
//   console.log('The solution is: ', results[0].solution);
// });

// connection.end();

var fs         = require('fs'),
    async      = require('async'),
    clui       = require('clui'),
    clc        = require('cli-color'),
    mysql      = require('mysql'),
    settings   = require('./settings.js'),
    utils      = require('./utils.js'),
    _          = require('lodash'),

    connection = mysql.createConnection(settings.mysql),
    countdown  = new clui.Spinner('Establishing a connection...  ', ['|', '/', '-', '\\']);

connection.connect();
countdown.start();

const PEOPLE_TYPE = ['authors', 'editors', 'dedicatee', 'contributors', 'censors', 'illustrators'];


async.waterfall([
  // select all books records ids!
  (next) => {
    console.log(clc.yellowBright('1  '), clc.blackBright(settings.mysql.query.getBookIds))
    connection.query(settings.mysql.query.getBookIds, (error, results) => {
      if (error) {
        next(error);
        return;
      }
      next(null, _.map(results, 'RecordId'))
    })

  },
  // get the basics!!!
  (records, next) => {
    let rl = records.length;
    console.log(clc.blackBright('    - records:'),rl);
    console.log(clc.yellowBright('2  '), clc.blackBright('parsing records'))
    
    
    let q = async.queue( (record, nextRecord) => {
      console.log('\n    RECORD', record)
      async.waterfall([
        // select book!
        (next) => {
          countdown.message('executing query for:' + record+ '; remaining: '+ q.length()+ '/'+ rl);
          console.log(clc.yellowBright('    * '),clc.blackBright(settings.mysql.query.getBookById), clc.yellowBright(record))
    
          connection.query(settings.mysql.query.getBookById, [record], (error, results, fields) => {
            if (error) {
              next(error);
              return;
            }
            var res = results[0],
                book;

            book = {
              slug: res.RecordId,
              title: res.ShortTitle,
              abstract: res.LongTitle,
              languages: res.Languages.split('|').map(d => d.toLowerCase()),
              
              authors      : utils.splitIds(res.AuthorIds),
              editors      : utils.splitIds(res.EditorIds),
              academies    : utils.splitIds(res.AcademyIds),
              dedicatee    : utils.splitIds(res.DedicateeIds),
              contributors : utils.splitIds(res.ContributorIds),
              censors      : utils.splitIds(res.CensorIds),
              illustrators : utils.splitIds(res.IllustratorIds),

              publication: {
                place:  {
                  _id: res.PublicationPlaceLatinNameId || res.PublicationPlaceEnglishNameId || res.PublicationPlaceItalianNameId,
                },
                year: parseInt(res.PublicationYear)
              },

              subjects : _.compact(res.Subjects.split('|')).map(d => {
                return {
                  entity_type: 'theme:subject',
                  slug: utils.slugify(d.trim()),
                  name: d.trim()
                }
              }),

              illustrations : _.compact(res.Illustrations.split('|')).map(d => {
                return {
                  entity_type: 'illustration',
                  slug: utils.slugify(d.trim()),
                  name: d.trim()
                }
              }),
              errors: []
            }
            console.log(clc.blackBright('    - title:'), book.title);
            // parse date from the dedication place
            // e.g. DedicationPlace: 'Naples 1 April 1616',
            console.log(res)

            
            // console.log(book); // book, subjects, authors, editors, academies);
            countdown.message('query executed.');
            next(null, book);
          });
        },
        // collect places @todo (from )
        // (book, next) => {

        // },
        // collect academies (as institutions)
        (book, next) => {
          let q = utils.cypher.prepare(settings.mysql.query.getAcademiesByIds, {
            ids: _.map(book.academies, '_id').join(',')
          });
          console.log(clc.yellowBright('    *  '), clc.blackBright('filling', clc.cyanBright('academies'), 'nodes:'), book.academies);
          connection.query(q, (error, results) => {
            if (error) {
              next(error);
              return;
            }
            if(results.length != book.academies.length) {
              book.errors.push({
                error: 'itacitemacademy results non matching expected _id',
                results: results,
                expected: book.academies
              })
            }
            // console.log(results)
            book.academies = results.map( academy => {
              return {
                slug: utils.slugify(academy.Name),
                name: academy.Name,
                _id:  academy.id,
                uuid: academy.RecordId,
                location_type: 'academy',
                city: {
                  _id: academy.CityId,
                  uuid: 'city-'+academy.CityId,
                  slug: utils.slugify(academy.FictitiousName || academy.CityEnglishName || academy.CityItalianName),
                  name: academy.FictitiousName || academy.CityEnglishName || academy.CityItalianName,
                  location_type: 'city',
                },
                description: [
                  'Alternative name: ' + academy.Alternativename,
                  'Motto: ' + academy.Motto,
                  'EmblemDescription: ' + academy.EmblemDescription,
                  academy.Notes
                  
                ].join('\n\n')
              }
            })
            console.log(clc.blackBright('    nodes:'), _.map(book.academies, 'name'));
            next(null, book);
          })
        },

        // for each academy, get the city
        (book, next) => {
          console.log(clc.yellowBright('    *  '), clc.blackBright('filling', clc.cyanBright('academies places'), 'nodes:'), _.map(book.academies, 'name'));
          
          async.parallel(book.academies.map(academy => (callback) => {
            connection.query(settings.mysql.query.getCityById,[academy.city._id], (error, results) => {
              if (error) {
                callback(error);
                return;
              }
              
              if(!results.length){
                book.errors.push({
                  error: 'itaccvcities non matching city _id',
                  results: results,
                  expected: academy.city
                })
              } else {
                _.assign(academy.city, {
                  name_it: results[0].ItalianName,
                  name_en: results[0].EnglishName,
                  name_latin: results[0].LatinName,
                  description: results[0].FictitiousName
                })
              }
              callback(null, academy)
            })

          }), (err, results) => {
            if (err) {
              next(err);
              return;
            }

            next(null, book);
          })

        },

        // collect authors, editors
        (book, next) => {
          console.log(clc.yellowBright('    *  '), clc.blackBright('filling', clc.blackBright('people'), 'nodes:'), ['authors', 'editors'] );
          
          async.parallel(PEOPLE_TYPE.map( personGroup => (callback) => {
            console.log(clc.yellowBright('   '),clc.blackBright('-', clc.cyanBright(personGroup), 'nodes:'), book[personGroup]);
            if(!book[personGroup].length) {
              callback();
              return
            }
            let q = utils.cypher.prepare(settings.mysql.query.getPeopleByIds, {
              ids: _.map(book[personGroup], '_id').join(',')
            });
            connection.query(q, (error, results) => {
              if (error) {
                callback(error);
                return;
              }
              if(results.length != book[personGroup].length){
                book.errors.push({
                  error: 'itacitemperson non matching '+personGroup + ' _id',
                  results: results,
                  expected: book[personGroup]
                })
              }
              // console.log(results)
              book[personGroup] = results.map( person => {
                return {
                  slug: utils.slugify(person.Name),
                  name: person.Name,
                  first_name: person.Forename,
                  last_name: person.Surname,
                  birth_date: person.BirthDate,
                  death_date: person.DeathDate,
                  _id:  person.Id,
                  uuid: person.RecordId,
                  role: personGroup,
                  description: [
                    person.PersonalTitles.trim()
                  ].join('\n\n')
                }
              })
              console.log( clc.blackBright('    --> ',clc.cyanBright(personGroup),'nodes:'), _.map(book[personGroup], 'name'));
              callback();
            })
          }), (error) => {
            if (error) {
              next(error);
              return;
            }
            next(null, book);
          
          });  
        },

        // save as file
        (book, next) => {
          let filename = './data/'+ book.slug +'.json';
          console.log(clc.yellowBright('    *  '), clc.blackBright('saving data to'), filename);
          
          fs.writeFile(filename, JSON.stringify(book, null, 2), (error) => {
            if (error) {
              next(error);
              return;
            }
            console.log(clc.blackBright('    file written.'));
            next()
          });
        }
      ], (err) => {
        if(err){
          q.kill()
          next(err)
        } else
          nextRecord()
      });
    });
  q.push(records);
  q.drain = next;
  },
], (err) => {
  if(err){
    if(typeof err == 'object'){
      throw JSON.stringify(err);
    }
    throw err;
  }
  connection.end();
  countdown.stop();

  console.log("DONE!")
  // print book in JSON
  process.exit()

})






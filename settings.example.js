module.exports = {
  mysql: {
    host     : 'localhost',
    user     : 'user',
    password : '***********',
    database : 'dbname',
    query:{
      getBookById:  'SELECT * FROM dbname.<BOOKS TABLE> WHERE <ID> = ?',
      getBookIds: 'SELECT <ID> FROM dbname.<BOOKS TABLE>',
      getAcademiesByIds: 'SELECT * FROM dbname.<ACADEMIES TABLE> WHERE <ID> IN ({=ids})',
      getCityById: 'SELECT * FROM dbname.<CITIES TABLE> WHERE <ID> = ?',
      getPeopleByIds: 'SELECT * FROM dbname.<PEOPLE TABLE> WHERE <ID> IN ({=ids})'
    }
  },
  neo4j:{
    server: "bolt://localhost:7687",
    auth: {
      user: "neo4j", 
      password: "neo4j"
    }
  },
  path: './data/**/*.json'
}
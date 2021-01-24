const express = require('express')
const fs = require('fs');
var bodyParser = require('body-parser');
const app = express()
const port = 3000

//structure of code will be much better with db 

//////the middleware
// Configuring body parser middleware & public folder
app.use(express.json());
app.use(express.static('public')); 

app.use((req,res,next)=>{
    let logObj = {
        url:req.url,
        method:req.method,
        CurrentTime:new Date()
    }
    console.log(logObj)
    next();  ///needed to get out the middleware
})

///global error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send('internal server error !')
    next();
})


///////main routes for todos
app.get('/', (req, res) =>{
    res.redirect('/api/todos');
})

///api to get all todos
app.get('/api/todos', (req, res) =>{
    const todos = getAllTodos();
    res.send(todos);
})

///tried to make it better??
// app.get('/api/todos', (req,res)=> getAllTodos(req,res));

function getAllTodos(){
    //sync func
    const todos = fs.readFileSync('./db.json',{encoding:'utf-8'});
    return todos
}

///api to post new todo to specific user
app.post('/api/todos/', (req, res) =>{
    const todo = req.body;
    let newId = addNewTodo(todo.title,todo.username);
    if(newId === 9999)
        res.send(`<p>you are not logged in</p>`);
    else if(newId === -1)
        res.send(`<p>username not exist</p>`);
    else
        res.send(`<p>Todo with id ${newId} was added successfully</p>`);
})

function addNewTodo(title,username){
    let TodosList = getTodosObj();
    let LoggedUsername = getLoggedInUsername();
    let check = checkIfUserExist(username)
    if(LoggedUsername === username && check){
        ///prepare the new todo
        const newId = TodosList.length+1;
        const newTodo = { id: newId, title: title, status: 'todo', username: username } 
        TodosList.push(newTodo);
        let obj ={ToDos:TodosList}
        putObjToFile(obj,"db");
        return newId;
    }else if(!check){
        return -1;
    }else{
        return 9999;
    }

}

///api to get todos of specific user
app.get('/api/todos/:username', (req, res) =>{
    const username = req.params.username;
    const userTodos = getUserTodos(username);
    res.send(userTodos);
})

function getUserTodos(username){
    let TodosList = getTodosObj();
    TodosList = TodosList.filter( todo => todo.username === username) 
    return TodosList
}

///api to delete todo with id
app.delete('/api/todos/:id', (req, res) =>{
    const id = req.params.id;
    deleteTodoWithId(id);
    res.send(`<p>Todo with id ${id} was deleted successfully</p>`);
})

function deleteTodoWithId(id){
    let TodosList = getTodosObj();
    //to get all the todos except with the id U want to delete
    TodosList = TodosList.filter( todo => todo.id !== parseInt(id)) 
    let obj ={ToDos:[TodosList]}
    putObjToFile(obj,"db");
}

///api to PATCH todo with id
app.patch('/api/todos/:id', (req, res) =>{
    const id = req.params.id;
    const modifiedTodo = req.body;
    const check  = editTodoWithId(id , modifiedTodo.title,modifiedTodo.status);
    if (check)
        res.send(`<p>Todo with id ${id} was edited successfully</p>`);
    else
        res.send("invalid attributes: please enter exist todo that you own")
})

function editTodoWithId(id,newTitle, newStatus){
    let flag = 0;
    let TodosList = getTodosObj();
    let LoggedUsername = getLoggedInUsername();
    //to get edit the todo with id
    TodosList = TodosList.map( todo => {
        if(todo.id === parseInt(id) && todo.username === LoggedUsername){
            todo.title = newTitle;
            todo.status = newStatus;
            flag = 1;
        }
        return todo
    }) 
    if(flag){
    let obj ={ToDos:TodosList}
    putObjToFile(obj,"db");
    }
    return flag;
}

///////main routes for users
///api to register (add new user)
app.post('/api/users/register', (req, res) =>{
    const user = req.body;
    if(user.username && user.password && user.firstname){
        let check = addNewUser(user.username , user.password , user.firstname);
        if(!check) ///unique username
            res.send(`<p>user was registered successfully</p>`);
        else ///username already exists
            res.status(422).send(`<p>there already a user with this username !</p>`);
    }else{
        res.status(422).send(`<p>username,password , firstname are required !!</p>`);
    }
})

function addNewUser(userName,password,firstName){
    logoutUser();
    let flag = 0;
    ///check if username exist
    let UsersList = getUsersObj();
    UsersList = UsersList.map( user => {
        if(user.username === userName){
            flag = 1;
        }
        return user
    }) 
    if(!flag){  ///the username unique
        const newUser = { username: userName, password: password, firstname: firstName,loggedIn:true } 
        ///push the new node to the json
        UsersList.push(newUser);
        let obj ={users:UsersList}
        // update the json file with async write
        putObjToFile(obj,"users");
    }
    return flag;
}

////api to login user
app.post('/api/users/login', (req, res) =>{
    const user = req.body;
    const check  = loginUser(user.username , user.password);
    switch(check){
        case 0:
            res.status(401).send("invalid credentials: user not found")
            break;
        case 1:
            res.status(401).send("already logged in user ,need to logout first")
            break;
        case 2:
            ///i used json cuz it is more than one statement
            const obj = {
                message:"logged in successfully",
                profile:{
                    name:user.username
                }
            }
            res.send(obj);
            break;
    }
})

function loginUser(username, password){
    let flag = 0;
    ///check if there is already a logged In user
    let UsersList = getUsersObj();
    UsersList = UsersList.map( user => {
        if(user.loggedIn === true){
            flag = 1;
        }
        return user
    }) 
    if(!flag){  //no logged user
        ///check if username and password matches
        UsersList = UsersList.map( user => {
            if(user.username === username && user.password === password){
                user.loggedIn = true
                flag = 2;
            }
            return user
        }) 
        let obj ={users:UsersList}
        putObjToFile(obj,"users");
    }
    /// flag === 1 (indicates already logged in user)
    /// flag === 2 (username and password matches)
    /// flag === 0 (there is no match for username and password)
    return flag;
}

////api for logout
app.get('/api/users/logout', (req, res) =>{
    const check = logoutUser();
    if(check)
        res.send("U logged out successfully");
    else
        res.send("no logged in user !!");

})

function logoutUser(){
    let flag = 0;
    let UsersList = getUsersObj();
    ///check if there is already a logged In user
    UsersList = UsersList.map( user => {
        if(user.loggedIn === true){
            user.loggedIn = false
            flag = 1;
        }
        return user
    }) 
    if(flag){
        let obj ={users:UsersList}
        putObjToFile(obj,"users");
    }
    return flag;
}

///refactor the code 
function getUsersObj(){
    const users = fs.readFileSync('./users.json',{encoding:'utf-8'});
    const UsersObj = JSON.parse(users)
    return UsersObj.users;
}

function getTodosObj(){
    const todos = fs.readFileSync('./db.json',{encoding:'utf-8'});
    const TodosObj = JSON.parse(todos)
    return TodosObj.ToDos;
}

function putObjToFile(obj,file){
    fs.writeFile(`./${file}.json`,JSON.stringify(obj),(err)=>{
        if (err) throw err;
        console.log('The json file has been modified!');
    })
}

function getLoggedInUsername(){
    let username;
    let UsersList = getUsersObj();
    UsersList = UsersList.map( user => {
        if(user.loggedIn === true){
            username = user.username
        }
        return user
    }) 
    return username;
}

function checkIfUserExist(username){
    let flag = 0;
    let UsersList = getUsersObj();
    UsersList = UsersList.map( user => {
        if(user.username === username){
            flag = 1;
        }
        return user
    }) 
    return flag;
}

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

//async func /// cannt make it work for some reason!!
// fs.readFile('./db.json',(err,todos)=>{
//     if(err) throw err;
//     else return todos;
// })

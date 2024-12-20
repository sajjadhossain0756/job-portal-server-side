const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()

const port = process.env.PORT || 9000
const app = express()

app.use(cors({
   origin: [
    'http://localhost:5173',
    'https://job-portal-project-ce2d8.web.app/',
    'https://job-portal-project-ce2d8.firebaseapp.com/'
   ],
   credentials: true
}))
app.use(express.json())
app.use(cookieParser())

const verifyToken = (req,res,next) =>{
     const token = req.cookies?.token;
     if(!token){
        return res.status(401).send({message: 'unAthorize Access'})
     }
    // verify token
    jwt.verify(token,process.env.ACCESS_TOKEN,(err,decoded)=>{
        if(err){
          return res.status(401).send({message: 'unAthorize Access'})
        }
        req.user = decoded;
        next()
    }) 
     
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ahkjv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const database = client.db("jobPortal");
    const jobsCollection = database.collection("jobs");
    const applicationCollection = database.collection("jobApplication");

    // create one data in db
    app.post('/jobs', async(req,res)=>{
        const jobs = req.body;
        const result = await jobsCollection.insertOne(jobs)
        res.send(result)
    })
    // get all job from db;
    app.get('/jobs',async(req,res)=>{
      const email = req.query.email
      let query = {}
      if(email){
        query = {hr_email: email}
      }
      const cursor = jobsCollection.find(query)
      const result = await cursor.toArray();
      res.send(result)
    })
    // get one data with id from db
    app.get('/jobs/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await jobsCollection.findOne(query);
      res.send(result)
    })

    // get user application data from db
    app.get('/job_application',verifyToken,async(req,res)=>{
       const email = req.query.email;
       const query = {applicant_email: email}
      //  check valid user
       if(req.user.email !== req.query.email){
           return res.status(403).send({message: 'forbidden'})
       }
       const result = await applicationCollection.find(query).toArray()

      //  fokira way
      for(const application of result){
         const query1 = {_id: new ObjectId(application.job_id)}
         const job = await jobsCollection.findOne(query1)
         if(job){
            application.title = job.title;
            application.company = job.company;
            application.company_logo = job.company_logo
         }
      }
       res.send(result)
    })
    // get user application in one job data from db
    app.get('/job_application/jobs/:job_id',async(req,res)=>{
        const id = req.params.job_id
        const query = {job_id: id}
        const result = await applicationCollection.find(query).toArray()
        res.send(result)
    })
    // json web token api
    app.post('/jwt',(req,res)=>{
        const user = req.body
        const token = jwt.sign(user,process.env.ACCESS_TOKEN,{
          expiresIn: '1h'
        })
        
        res.cookie('token',token,{
           httpOnly: true,
           secure: false //its will be when its render for production
        })
        .send({success: true})
    })
    // clear cookie 
    app.post('/logout',(req,res)=>{
       res.clearCookie('token',{
          httpOnly: true,
          secure: false
       })
       .send({success: true})
    })

    // create application in db]
    app.post('/job_application',async(req,res)=>{
        const applicationData = req.body;
        const result = await applicationCollection.insertOne(applicationData)

        // not bestway find application count
        const id = applicationData.job_id;
        const query = {_id: new ObjectId(id)}
        const job = await jobsCollection.findOne(query)
        let count = 0;
        if(job.applicationCount){
          count = job.applicationCount + 1;
        }
        else{
          count = 1;
        }
        // update job info
        const filter = {_id: new ObjectId(id)}
        const updateDoc = {
          $set: {
            applicationCount: count
          }
        }
        const updateResult = await jobsCollection.updateOne(filter,updateDoc);
        res.send(result)

    })
    // update application status
    app.patch('/job_application/:id',async(req,res)=>{
       const id = req.params.id;
       const data = req.body;
       const filter = {_id: new ObjectId(id)}
       const updateDoc = {
           $set: {
              status: data.status
           }
       }
       const result = await applicationCollection.updateOne(filter,updateDoc)
       res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from SoloSphere Server....')
})

app.listen(port, () => console.log(`Server is running at http://localhost:${port}`))

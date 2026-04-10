// Netlify Serverless 函数 - 后端 API 适配
const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const session = require('express-session');

// 连接 MongoDB
const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  const MONGODB_URI = process.env.MONGODB_URI;
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

// 数据模型
const QuestionSchema = new mongoose.Schema({
  content: { type: String, required: true },
  type: { type: String, enum: ['system', 'user'], default: 'user' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  questionContent: String,
  questionType: String,
  answer: { type: String, required: true },
  answeredBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  openid: { type: String, required: true, unique: true },
  isVisitor: { type: Boolean, default: true },
  firstVisitAt: { type: Date, default: Date.now },
  lastVisitAt: { type: Date, default: Date.now },
  visitCount: { type: Number, default: 1 }
});

const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);
const Answer = mongoose.models.Answer || mongoose.model('Answer', AnswerSchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// 初始化系统问题
const initSystemQuestions = async () => {
  const count = await Question.countDocuments({ type: 'system' });
  if (count === 0) {
    const systemQuestions = [
      '你最害怕失去什么？',
      '如果可以回到过去，你想改变什么？',
      '你最后悔的事情是什么？',
      '你最想对某个人说什么？',
      '你最大的梦想是什么？'
    ];
    for (const content of systemQuestions) {
      await Question.create({ content, type: 'system', status: 'approved' });
    }
    console.log('System questions initialized');
  }
};

const app = express();
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'truth_or_dare_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true, sameSite: 'none', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// API 路由
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

app.post('/auth/visitor', async (req, res) => {
  try {
    const { visitorId } = req.body;
    if (!visitorId) {
      return res.status(400).json({ success: false, message: '缺少访客ID' });
    }
    req.session.openid = visitorId;
    let user = await User.findOne({ openid: visitorId });
    if (user) {
      user.lastVisitAt = new Date();
      user.visitCount += 1;
      await user.save();
    } else {
      user = new User({ openid: visitorId, isVisitor: true });
      await user.save();
    }
    res.json({ success: true, data: { visitorId, isVisitor: true } });
  } catch (error) {
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

app.get('/auth/status', (req, res) => {
  if (req.session.openid) {
    res.json({ success: true, data: { isLoggedIn: true, openid: req.session.openid } });
  } else {
    res.json({ success: true, data: { isLoggedIn: false } });
  }
});

app.get('/questions/random', async (req, res) => {
  try {
    const openid = req.session.openid;
    if (!openid) {
      return res.status(401).json({ success: false, message: '请先登录' });
    }
    const user = await User.findOne({ openid });
    const isOldUser = user && user.visitCount > 2;
    let matchStage = { status: 'approved' };
    if (isOldUser) matchStage.type = 'user';
    const questions = await Question.aggregate([{ $match: matchStage }, { $sample: { size: 1 } }]);
    if (questions.length === 0) {
      const systemQuestions = await Question.aggregate([{ $match: { type: 'system', status: 'approved' } }, { $sample: { size: 1 } }]);
      if (systemQuestions.length > 0) {
        return res.json({ success: true, data: { question: systemQuestions[0], isOldUser } });
      }
      return res.status(404).json({ success: false, message: '暂没有问题' });
    }
    res.json({ success: true, data: { question: questions[0], isOldUser } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取问题失败' });
  }
});

app.post('/questions/submit', async (req, res) => {
  try {
    const { content } = req.body;
    const openid = req.session.openid;
    if (!openid) return res.status(401).json({ success: false, message: '请先登录' });
    if (!content || content.trim().length < 5) {
      return res.status(400).json({ success: false, message: '问题内容至少5个字符' });
    }
    const question = new Question({ content: content.trim(), type: 'user', status: 'pending', createdBy: openid });
    await question.save();
    res.json({ success: true, message: '问题提交成功，等待审核' });
  } catch (error) {
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

app.post('/answers/submit', async (req, res) => {
  try {
    const { questionId, answer } = req.body;
    const openid = req.session.openid;
    if (!openid) return res.status(401).json({ success: false, message: '请先登录' });
    if (!answer || answer.trim().length === 0) {
      return res.status(400).json({ success: false, message: '请输入回答内容' });
    }
    const question = await Question.findById(questionId);
    if (!question) return res.status(404).json({ success: false, message: '问题不存在' });
    const newAnswer = new Answer({ questionId, questionContent: question.content, questionType: question.type, answer: answer.trim(), answeredBy: openid });
    await newAnswer.save();
    res.json({ success: true, message: '回答提交成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

app.get('/answers/my', async (req, res) => {
  try {
    const openid = req.session.openid;
    if (!openid) return res.status(401).json({ success: false, message: '请先登录' });
    const answers = await Answer.find({ answeredBy: openid }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: { answers } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

app.post('/admin/init-questions', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: '管理员账号或密码错误' });
    }
    await initSystemQuestions();
    res.json({ success: true, message: '系统问题初始化完成' });
  } catch (error) {
    res.status(500).json({ success: false, message: '初始化失败' });
  }
});

app.post('/admin/stats', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: '管理员账号或密码错误' });
    }
    const stats = {
      totalUsers: await User.countDocuments(),
      totalQuestions: await Question.countDocuments(),
      systemQuestions: await Question.countDocuments({ type: 'system' }),
      userQuestions: await Question.countDocuments({ type: 'user' }),
      pendingQuestions: await Question.countDocuments({ status: 'pending' }),
      totalAnswers: await Answer.countDocuments()
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

module.exports.handler = serverless(app);

import express from 'express'
import authMiddleware from '../middlewere/authMiddleware.js';
import { getAiSuggestions } from '../ai/aiSuggestionController.js';

const aiRouter = express.Router();

aiRouter.get("/ai-recommended-foods", authMiddleware, getAiSuggestions)

export default aiRouter;
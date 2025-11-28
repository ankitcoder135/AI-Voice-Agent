import axios from "axios";
import { CoachingOptions } from "./Options";


export const getToken = async () => {
    try {
        const result = await axios.get('/api/getToken');
        return result.data.token;
    } catch (error) {
        console.error("Error fetching token:", error);
        throw error;
    }
}




export const AIModel =  async (topic, coachingOption, msg, history = []) => {
    const option = CoachingOptions.find((item) => item.name === coachingOption);
    const PROMPT = option.prompt.replace('{user_topic}', topic);
    try {
      const response = await axios.post('/api/aiModel', {
        prompt: PROMPT,
        msg: msg,
        history: history
      });

      console.log("AIModel response:", response.data);

      // API returns shape: { response: { role, content, ... } }
      return response.data;
    } catch (error) {
      console.error("Error calling AIModel API:", error);
      throw error;
    }
}
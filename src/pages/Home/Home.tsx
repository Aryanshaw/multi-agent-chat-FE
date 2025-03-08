import { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '../../utils/socketContext';
import './Home.css';

interface Message {
  sender: string;
  text: string;
  type: 'user-message' | 'ai-message' | 'system-message' | 'error-message' | 'loader';
  id?: string;
  agentType?: string;
  status?: 'thinking' | 'completed' | 'error';
}

const Home = () => {
  const { socket, isConnected, sendMessage } = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [processingResponse, setProcessingResponse] = useState(false);
  const [currentResponseId, setCurrentResponseId] = useState<string | null>(null);
  
  // Simplify by using a single state for agent status
  const [agentStatus, setAgentStatus] = useState<{
    [key: string]: { status: 'thinking' | 'completed' | 'error'; content: string }
  }>({});

  useEffect(() => {
    // Add system message when connection status changes
    if (isConnected) {
      addMessage('System', 'Connected to server', 'system-message');
    } else {
      addMessage('System', 'Disconnected from server', 'system-message');
    }
  }, [isConnected]);

  useEffect(() => {
    if (!socket) return;

    // Handle incoming messages
    const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle agent step status updates
          if (data.type === 'agent_step_status') {
            const { agent_type, status, content } = data;
            
            // Update agent status directly
            setAgentStatus(prev => ({
              ...prev,
              [agent_type]: { status, content }
            }));
            
            return;
          }
          
          // If we're already processing a response, ignore duplicate messages
          if (processingResponse) return;
          
          if (data.success === true) {
            // Set processing flag to prevent duplicate messages
            setProcessingResponse(true);
            
            // Extract the response text and find the last agent that processed the message
            const responseText = data.response;
            
            // Find the last non-end agent that processed the message
            let lastAgent = "AI";
            if (data.steps && data.steps.length > 0) {
              for (let i = data.steps.length - 1; i >= 0; i--) {
                if (data.steps[i].agent && data.steps[i].agent !== "end") {
                  lastAgent = data.steps[i].agent;
                  break;
                }
              }
            }
            console.log(lastAgent, "lastAgent");

            // Clean up the response text - remove duplicated content
            const cleanedResponse = cleanResponseText(responseText);
            
            // Add the AI response to the chat with agent information
            addMessage('AI', cleanedResponse, 'ai-message', undefined);
            setCurrentResponse('');
            
            // Reset processing flag after a short delay
            setTimeout(() => {
              setProcessingResponse(false);
            }, 500);
          } 
          else if (data.type === 'agent_start') {
            // Add agent to status with thinking state
            const { agent_type, content } = data;
            setAgentStatus(prev => ({
              ...prev,
              [agent_type]: { status: 'thinking', content: content || 'Processing...' }
            }));
          }
          else if (data.type === 'agent_complete') {
            // Remove agent from status when complete
            const { agent_type } = data;
            setAgentStatus(prev => {
              const newStatus = { ...prev };
              delete newStatus[agent_type];
              return newStatus;
            });
          }
          // Handle other message types as before
          else if (data.type === 'stream') {
            setCurrentResponse(prev => prev + data.content);
          } 
          else if (data.type === 'final') {
            setCurrentResponse(prev => prev + `\n\n---\n\n`);
          } 
          else if (data.type === 'complete') {
            setCurrentResponse('');
            // Clear all agent status when complete
            setAgentStatus({});
          }
          else if (data.type === 'error' || (data.success === false)) {
            // Error message
            const errorMessage = data.message || data.error?.join(', ') || 'Unknown error';
            addMessage('Error', errorMessage, 'error-message');
            setCurrentResponse('');
            // Clear all agent status on error
            setAgentStatus({});
          }
        } catch (error) {
          console.error('Error parsing message:', error);
          addMessage('Error', 'Failed to parse server message', 'error-message');
        }
      };
  
      // Add event listener
      socket.addEventListener('message', handleMessage);
  
      // Cleanup
      return () => {
        socket.removeEventListener('message', handleMessage);
      };
    }, [socket, currentResponse, processingResponse]);

  // Function to clean up response text by removing duplicated content
  const cleanResponseText = (text: string): string => {
    // Split by comma and check for duplicated content
    const parts = text.split(',');
    if (parts.length <= 1) return text;

    // Check if parts contain duplicated content
    const trimmedParts = parts.map(part => part.trim());
    const uniqueParts = [...new Set(trimmedParts)];

    return uniqueParts.join('\n\n');
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse, agentStatus]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (
    sender: string,
    text: string,
    type: Message['type'],
    id?: string,
  ) => {
    setMessages(prev => [...prev, { sender, text, type, id }]);
  };


  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      // Add user message to the chat
      addMessage('human', inputMessage, 'user-message');

      // Generate a unique ID for this AI response
      const uniqueResponseId = `ai-response-${Date.now()}`;

      // Add AI message placeholder for streaming
      addMessage('AI', '...', 'ai-message', uniqueResponseId);

      // Send the message to the server
      sendMessage({
        prompt: inputMessage,
        company_id: '673744c2388844f3c79d14e1',
        chat_room_id: '679397c762845e87a089aa27',
        company_name: 'demo',
        user_id: '673744c3388844f3c79d14e2'
      });

      // Clear the input
      setInputMessage('');

      // Store the current response ID
      setCurrentResponseId(uniqueResponseId);
    }
  };

  // Update the current AI message that's streaming
  useEffect(() => {
    if (currentResponse && currentResponseId) {
      const updatedMessages = messages.map(msg =>
        msg.id === currentResponseId
          ? { ...msg, text: currentResponse }
          : msg
      );
      setMessages(updatedMessages);
    }
  }, [currentResponse]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      <h1>Multi-Agent Chat</h1>
      
      <div className="connection-status">
        <h4>Status:</h4>
        <span className={isConnected ? 'connected' : 'disconnected'}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="messages-container" id="messages">
        {/* Render regular messages first */}
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={msg.type}
            id={msg.id}
          >
            <strong>{msg.type === 'user-message' ? 'You' : msg.type === 'ai-message' ? 'AI' : msg.sender}:</strong> 
            {/* Split text by newlines and add <br> tags */}
            {msg.text.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < msg.text.split('\n').length - 1 && <br />}
              </span>
            ))}
          </div>
        ))}
        
        {/* Render agent status messages below */}
        {Object.entries(agentStatus).map(([agentType, status]) => (
          <div key={`agent-${agentType}`} className={`agent-${status.status}`}>
            <div className={status.status === 'thinking' ? 'agent-loader' : 'agent-message'}>
              <span>{status.content}</span>
              {status.status === 'thinking' ? (
                <span className="loader"></span>
              ) : (
                <span className="checkmark">✓</span>
              )}
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <input
          type="text"
          id="prompt"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyUp={handleKeyPress}
          placeholder="Type your message here..."
          disabled={!isConnected}
        />
        <button 
          onClick={handleSendMessage} 
          disabled={!isConnected || !inputMessage.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Home;
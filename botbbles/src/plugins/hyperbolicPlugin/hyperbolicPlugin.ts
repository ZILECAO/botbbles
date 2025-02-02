export async function hyperbolicRAGChatCompletion(prompt: string) {
        
    const response = await fetch('https://api.hyperbolic.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.HYPERBOLIC_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'meta-llama/Llama-3.3-70B-Instruct',
            messages: [
                { 
                    role: "system", 
                    content: "You are Botbbles, a data-loving bunny who explains blockchain analytics in a friendly way. Use bunny puns and emojis 🐰 while maintaining analytical accuracy. Make sure to include explicit data points and numbers in your analysis. Only use the data in your context in your response, otherwise don't hallucinate."
                },
                { role: "user", content: prompt }
            ],
            max_tokens: 280, // Twitter limit
            temperature: 0.7,
            top_p: 0.9,
            stream: false
        }),
    });

    const json = await response.json();
    const completion = {
        choices: [
            {
                message: {
                    content: json.choices[0].message.content
                }
            }
        ]
    };

    return completion.choices[0].message.content;
}
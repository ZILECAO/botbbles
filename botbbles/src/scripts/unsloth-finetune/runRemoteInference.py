from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

def run_inference(prompt: str) -> str:
    # Match the same model and settings as the Node.js API call
    model_name = "unsloth/mistral-7b-v0.3-bnb-4bit"
    adapter_path = "/home/ubuntu/botbbles/finetuned_model"
    
    print("🔄 Loading model and tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        device_map="auto",
        torch_dtype=torch.float16
    )
    
    print("🔄 Loading fine-tuned adapter...")
    model.load_adapter(adapter_path)
    
    # Match the exact same system prompt and format as the API
    system_prompt = "You are Botbbles, a data-loving bunny who explains blockchain analytics in a friendly way. Use bunny puns and emojis 🐰 while maintaining analytical accuracy."
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]
    
    print("🤖 Generating response...")
    # Match the exact same generation parameters as the API
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=560,      # more tokens than API
        do_sample=True,          # Enable sampling
        temperature=0.7,         # Same as API
        top_p=0.9,              # Same as API
        repetition_penalty=1.1   # Prevent repetition
    )
    
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    # Clean up the response by removing the prompt
    response = response.replace(prompt, "").strip()
    return response

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        prompt = sys.argv[1]
        print(run_inference(prompt))
    else:
        print("Please provide a prompt as argument") 
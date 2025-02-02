import os
import json
from unsloth import FastLanguageModel, is_bfloat16_supported
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import load_dataset
import torch

def load_training_data(data_path):
    """Load and prepare training data from the specified path"""
    dataset = load_dataset("json", data_files={"train": data_path})
    return dataset["train"]

def fine_tune(model_name="unsloth/mistral-7b-bnb-4bit", 
              training_data_path="data/training_data.jsonl",
              output_dir="outputs/fine_tuned",
              metrics_path="outputs/metrics.json"):
    """Run fine-tuning process and track metrics"""
    
    print("Starting fine-tuning process...")
    
    # Load and prepare model
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_name,
        max_seq_length=2048,
        dtype=torch.bfloat16 if is_bfloat16_supported() else torch.float16,
        load_in_4bit=True,
    )
    
    # Load training data
    dataset = load_training_data(training_data_path)
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=1,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        logging_steps=10,
        save_steps=50,
        eval_steps=50,
    )
    
    # Initialize trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        tokenizer=tokenizer,
        args=training_args,
        packing=True,
    )
    
    # Capture initial metrics
    initial_metrics = trainer.evaluate()
    
    # Run training
    trainer.train()
    
    # Capture final metrics
    final_metrics = trainer.evaluate()
    
    # Calculate improvements
    improvements = {
        "loss_reduction": initial_metrics["eval_loss"] - final_metrics["eval_loss"],
        "initial_metrics": initial_metrics,
        "final_metrics": final_metrics
    }
    
    # Save metrics
    os.makedirs(os.path.dirname(metrics_path), exist_ok=True)
    with open(metrics_path, 'w') as f:
        json.dump(improvements, f)
    
    print("Fine-tuning complete. Metrics saved.")
    return improvements

if __name__ == "__main__":
    fine_tune()
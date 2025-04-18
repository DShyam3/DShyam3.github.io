def sort_and_remove_duplicates(input_file, output_file):
    try:
        # Read lines from the file
        with open(input_file, 'r') as file:
            lines = file.readlines()

        # Strip newline characters, remove duplicates, and sort
        sorted_unique_lines = sorted(set(line.strip() for line in lines))

        # Write the sorted unique lines to the output file
        with open(output_file, 'w') as file:
            for line in sorted_unique_lines:
                file.write(line + '\n')

        print(f"Sorted and unique content has been written to {output_file}.")
    except FileNotFoundError:
        print(f"The file {input_file} does not exist.")
    except Exception as e:
        print(f"An error occurred: {e}")


# Usage
input_file = '/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/movies.txt'
output_file = '/Users/dhyanshyam/Projects/DShyam3.github.io/MediaBoard/test_data/sorted.txt'
    

sort_and_remove_duplicates(input_file, output_file)

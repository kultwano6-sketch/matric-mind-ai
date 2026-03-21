export const calculateScore = (data) => {
      return Math.round(
          data.tests * 0.3 +
              data.homework * 0.2 +
                  data.past * 0.3 +
                      data.consistency * 0.2
                        );
                        };
                